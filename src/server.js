const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "memoryMuseumSecret";
const SESSION_COOKIE = "session_id";

const sessions = new Map();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "..", "public")));

function setSessionCookie(res, userid) {
  const sessionId = uuidv4();
  sessions.set(sessionId, { userid, createdAt: Date.now() });
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    signed: true,
  });
}

function destroySession(res, sessionId) {
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie(SESSION_COOKIE);
}

async function requireAuth(req, res, next) {
  try {
    const signedId = req.signedCookies?.[SESSION_COOKIE];
    if (!signedId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const session = sessions.get(signedId);
    if (!session) {
      destroySession(res, signedId);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
      where: { userid: session.userid },
      include: { gallery: true, authinfo: true },
    });
    if (!user) {
      destroySession(res, signedId);
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    req.sessionId = signedId;
    next();
  } catch (error) {
    next(error);
  }
}

function parseTimestamp(value, { useDefault } = { useDefault: false }) {
  if (value === undefined || value === null) {
    return useDefault ? BigInt(Date.now()) : undefined;
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value);
  }
  throw new Error("timestamp must be a bigint, number, or numeric string");
}

function normalizeArtIds(value, { allowEmptyDefault } = { allowEmptyDefault: false }) {
  if (value === undefined) {
    return allowEmptyDefault ? "[]" : undefined;
  }
  if (value === null) {
    return "[]";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error("artids must be an array or JSON string");
}

function transformArt(art) {
  if (!art) {
    return art;
  }
  return {
    artid: art.artid,
    path: art.path,
    timestamp: Number(art.timestamp),
    creatorid: art.creatorid,
  };
}

function transformOption(option) {
  if (!option) {
    return option;
  }
  return {
    optionid: option.optionid,
    timestamp: Number(option.timestamp),
  };
}

function transformGallery(gallery) {
  if (!gallery) {
    return gallery;
  }
  let parsedArtIds = [];
  if (gallery.artids) {
    try {
      parsedArtIds = JSON.parse(gallery.artids);
    } catch (_err) {
      parsedArtIds = [];
    }
  }
  return {
    galleryid: gallery.galleryid,
    artids: parsedArtIds,
    artidsRaw: gallery.artids,
    timestamp: Number(gallery.timestamp),
  };
}

function transformAuthInfo(authInfo) {
  if (!authInfo) {
    return authInfo;
  }
  return {
    authinfoid: authInfo.authinfoid,
    hashedpass: authInfo.hashedpass,
    userdecidedid: authInfo.userdecidedid,
  };
}

function transformUser(user) {
  if (!user) {
    return user;
  }
  return {
    userid: user.userid,
    galleryid: user.galleryid,
    optionid: user.optionid,
    authinfoid: user.authinfoid,
    timestamp: user.timestamp,
  };
}

app.post("/api/register", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const existing = await prisma.authInfo.findUnique({ where: { userdecidedid: username } });
    if (existing) {
      return res.status(409).json({ error: "username already exists" });
    }
    const hashedPass = await bcrypt.hash(password, 10);
    const now = Date.now();
    const nowBigInt = BigInt(now);
    const timestampText = new Date(now).toISOString();

    const createdGallery = await prisma.gallery.create({
      data: { artids: "[]", timestamp: nowBigInt },
    });
    const createdOption = await prisma.option.create({
      data: { timestamp: nowBigInt },
    });
    const createdAuth = await prisma.authInfo.create({
      data: { hashedpass: hashedPass, userdecidedid: username },
    });
    const user = await prisma.user.create({
      data: {
        galleryid: createdGallery.galleryid,
        optionid: createdOption.optionid,
        authinfoid: createdAuth.authinfoid,
        timestamp: timestampText,
      },
    });

    setSessionCookie(res, user.userid);
    res.status(201).json({ message: "registered", userid: user.userid });
  } catch (error) {
    next(error);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const authInfo = await prisma.authInfo.findUnique({
      where: { userdecidedid: username },
      include: { user: true },
    });
    if (!authInfo || !authInfo.user) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    const match = await bcrypt.compare(password, authInfo.hashedpass);
    if (!match) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    setSessionCookie(res, authInfo.user.userid);
    res.json({ message: "logged in", userid: authInfo.user.userid });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", requireAuth, (req, res) => {
  destroySession(res, req.sessionId);
  res.json({ message: "logged out" });
});

app.post("/api/upload", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }
    const relativePath = path.posix.join("uploads", req.file.filename);
    const art = await prisma.art.create({
      data: {
        path: relativePath,
        timestamp: BigInt(Date.now()),
        creatorid: req.user.userid,
      },
    });

    const artIds = JSON.parse(req.user.gallery.artids || "[]");
    artIds.push(art.artid);
    await prisma.gallery.update({
      where: { galleryid: req.user.galleryid },
      data: { artids: JSON.stringify(artIds), timestamp: BigInt(Date.now()) },
    });

    res.status(201).json({
      message: "uploaded",
      art: {
        ...art,
        timestamp: Number(art.timestamp),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/gallery", requireAuth, async (req, res, next) => {
  try {
    const artIds = JSON.parse(req.user.gallery.artids || "[]");
    if (artIds.length === 0) {
      return res.json({ arts: [] });
    }
    const arts = await prisma.art.findMany({
      where: { artid: { in: artIds } },
      orderBy: { artid: "asc" },
    });
    res.json({
      arts: arts.map((art) => ({
        ...art,
        timestamp: Number(art.timestamp),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session", requireAuth, (req, res) => {
  res.json({ userid: req.user.userid, username: req.user.authinfo.userdecidedid });
});

// --- CRUD: Art ------------------------------------------------------------
app.get("/api/arts", requireAuth, async (_req, res, next) => {
  try {
    const arts = await prisma.art.findMany({ orderBy: { artid: "asc" } });
    res.json({ arts: arts.map(transformArt) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/arts/:artid", requireAuth, async (req, res, next) => {
  try {
    const artid = Number(req.params.artid);
    if (!Number.isInteger(artid)) {
      return res.status(400).json({ error: "invalid art id" });
    }
    const art = await prisma.art.findUnique({ where: { artid } });
    if (!art) {
      return res.status(404).json({ error: "art not found" });
    }
    res.json({ art: transformArt(art) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/arts", requireAuth, async (req, res, next) => {
  try {
    const { path: artPath, timestamp, creatorid } = req.body;
    if (!artPath) {
      return res.status(400).json({ error: "path is required" });
    }
    const creatorId = creatorid !== undefined ? Number(creatorid) : req.user.userid;
    if (!Number.isInteger(creatorId)) {
      return res.status(400).json({ error: "creatorid must be an integer" });
    }
    let ts;
    try {
      ts = parseTimestamp(timestamp, { useDefault: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const art = await prisma.art.create({
      data: { path: artPath, timestamp: ts, creatorid: creatorId },
    });
    res.status(201).json({ art: transformArt(art) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/arts/:artid", requireAuth, async (req, res, next) => {
  try {
    const artid = Number(req.params.artid);
    if (!Number.isInteger(artid)) {
      return res.status(400).json({ error: "invalid art id" });
    }
    const data = {};
    if (req.body.path !== undefined) {
      data.path = req.body.path;
    }
    if (req.body.creatorid !== undefined) {
      const creatorId = Number(req.body.creatorid);
      if (!Number.isInteger(creatorId)) {
        return res.status(400).json({ error: "creatorid must be an integer" });
      }
      data.creatorid = creatorId;
    }
    if (req.body.timestamp !== undefined) {
      try {
        const ts = parseTimestamp(req.body.timestamp);
        if (ts !== undefined) {
          data.timestamp = ts;
        }
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no valid fields provided" });
    }
    const art = await prisma.art.update({ where: { artid }, data });
    res.json({ art: transformArt(art) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/arts/:artid", requireAuth, async (req, res, next) => {
  try {
    const artid = Number(req.params.artid);
    if (!Number.isInteger(artid)) {
      return res.status(400).json({ error: "invalid art id" });
    }
    await prisma.art.delete({ where: { artid } });
    res.json({ message: "art deleted" });
  } catch (error) {
    next(error);
  }
});

// --- CRUD: Gallery --------------------------------------------------------
app.get("/api/galleries", requireAuth, async (_req, res, next) => {
  try {
    const galleries = await prisma.gallery.findMany({ orderBy: { galleryid: "asc" } });
    res.json({ galleries: galleries.map(transformGallery) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/galleries/:galleryid", requireAuth, async (req, res, next) => {
  try {
    const galleryid = Number(req.params.galleryid);
    if (!Number.isInteger(galleryid)) {
      return res.status(400).json({ error: "invalid gallery id" });
    }
    const gallery = await prisma.gallery.findUnique({ where: { galleryid } });
    if (!gallery) {
      return res.status(404).json({ error: "gallery not found" });
    }
    res.json({ gallery: transformGallery(gallery) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/galleries", requireAuth, async (req, res, next) => {
  try {
    let artids;
    try {
      artids = normalizeArtIds(req.body.artids, { allowEmptyDefault: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let timestamp;
    try {
      timestamp = parseTimestamp(req.body.timestamp, { useDefault: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const gallery = await prisma.gallery.create({ data: { artids, timestamp } });
    res.status(201).json({ gallery: transformGallery(gallery) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/galleries/:galleryid", requireAuth, async (req, res, next) => {
  try {
    const galleryid = Number(req.params.galleryid);
    if (!Number.isInteger(galleryid)) {
      return res.status(400).json({ error: "invalid gallery id" });
    }
    const data = {};
    if (req.body.artids !== undefined) {
      try {
        data.artids = normalizeArtIds(req.body.artids, { allowEmptyDefault: true });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    if (req.body.timestamp !== undefined) {
      try {
        const ts = parseTimestamp(req.body.timestamp);
        if (ts !== undefined) {
          data.timestamp = ts;
        }
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no valid fields provided" });
    }
    const gallery = await prisma.gallery.update({ where: { galleryid }, data });
    res.json({ gallery: transformGallery(gallery) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/galleries/:galleryid", requireAuth, async (req, res, next) => {
  try {
    const galleryid = Number(req.params.galleryid);
    if (!Number.isInteger(galleryid)) {
      return res.status(400).json({ error: "invalid gallery id" });
    }
    await prisma.gallery.delete({ where: { galleryid } });
    res.json({ message: "gallery deleted" });
  } catch (error) {
    next(error);
  }
});

// --- CRUD: Option ---------------------------------------------------------
app.get("/api/options", requireAuth, async (_req, res, next) => {
  try {
    const options = await prisma.option.findMany({ orderBy: { optionid: "asc" } });
    res.json({ options: options.map(transformOption) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/options/:optionid", requireAuth, async (req, res, next) => {
  try {
    const optionid = Number(req.params.optionid);
    if (!Number.isInteger(optionid)) {
      return res.status(400).json({ error: "invalid option id" });
    }
    const option = await prisma.option.findUnique({ where: { optionid } });
    if (!option) {
      return res.status(404).json({ error: "option not found" });
    }
    res.json({ option: transformOption(option) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/options", requireAuth, async (req, res, next) => {
  try {
    let timestamp;
    try {
      timestamp = parseTimestamp(req.body.timestamp, { useDefault: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const option = await prisma.option.create({ data: { timestamp } });
    res.status(201).json({ option: transformOption(option) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/options/:optionid", requireAuth, async (req, res, next) => {
  try {
    const optionid = Number(req.params.optionid);
    if (!Number.isInteger(optionid)) {
      return res.status(400).json({ error: "invalid option id" });
    }
    if (req.body.timestamp === undefined) {
      return res.status(400).json({ error: "no valid fields provided" });
    }
    let timestamp;
    try {
      timestamp = parseTimestamp(req.body.timestamp, { useDefault: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const option = await prisma.option.update({ where: { optionid }, data: { timestamp } });
    res.json({ option: transformOption(option) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/options/:optionid", requireAuth, async (req, res, next) => {
  try {
    const optionid = Number(req.params.optionid);
    if (!Number.isInteger(optionid)) {
      return res.status(400).json({ error: "invalid option id" });
    }
    await prisma.option.delete({ where: { optionid } });
    res.json({ message: "option deleted" });
  } catch (error) {
    next(error);
  }
});

// --- CRUD: AuthInfo -------------------------------------------------------
app.get("/api/authinfos", requireAuth, async (_req, res, next) => {
  try {
    const authInfos = await prisma.authInfo.findMany({ orderBy: { authinfoid: "asc" } });
    res.json({ authinfos: authInfos.map(transformAuthInfo) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/authinfos/:authinfoid", requireAuth, async (req, res, next) => {
  try {
    const authinfoid = Number(req.params.authinfoid);
    if (!Number.isInteger(authinfoid)) {
      return res.status(400).json({ error: "invalid authinfo id" });
    }
    const authInfo = await prisma.authInfo.findUnique({ where: { authinfoid } });
    if (!authInfo) {
      return res.status(404).json({ error: "authinfo not found" });
    }
    res.json({ authinfo: transformAuthInfo(authInfo) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/authinfos", requireAuth, async (req, res, next) => {
  try {
    const { userdecidedid, password, hashedpass } = req.body;
    if (!userdecidedid) {
      return res.status(400).json({ error: "userdecidedid is required" });
    }
    let resolvedHashedPass;
    if (password) {
      resolvedHashedPass = await bcrypt.hash(password, 10);
    } else if (hashedpass) {
      resolvedHashedPass = hashedpass;
    } else {
      return res.status(400).json({ error: "password or hashedpass is required" });
    }
    const authInfo = await prisma.authInfo.create({
      data: { userdecidedid, hashedpass: resolvedHashedPass },
    });
    res.status(201).json({ authinfo: transformAuthInfo(authInfo) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/authinfos/:authinfoid", requireAuth, async (req, res, next) => {
  try {
    const authinfoid = Number(req.params.authinfoid);
    if (!Number.isInteger(authinfoid)) {
      return res.status(400).json({ error: "invalid authinfo id" });
    }
    const data = {};
    if (req.body.userdecidedid !== undefined) {
      data.userdecidedid = req.body.userdecidedid;
    }
    if (req.body.password !== undefined) {
      if (req.body.password) {
        data.hashedpass = await bcrypt.hash(req.body.password, 10);
      } else {
        return res.status(400).json({ error: "password cannot be empty" });
      }
    } else if (req.body.hashedpass !== undefined) {
      if (!req.body.hashedpass) {
        return res.status(400).json({ error: "hashedpass cannot be empty" });
      }
      data.hashedpass = req.body.hashedpass;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no valid fields provided" });
    }
    const authInfo = await prisma.authInfo.update({ where: { authinfoid }, data });
    res.json({ authinfo: transformAuthInfo(authInfo) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/authinfos/:authinfoid", requireAuth, async (req, res, next) => {
  try {
    const authinfoid = Number(req.params.authinfoid);
    if (!Number.isInteger(authinfoid)) {
      return res.status(400).json({ error: "invalid authinfo id" });
    }
    await prisma.authInfo.delete({ where: { authinfoid } });
    res.json({ message: "authinfo deleted" });
  } catch (error) {
    next(error);
  }
});

// --- CRUD: User -----------------------------------------------------------
app.get("/api/users", requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { userid: "asc" } });
    res.json({ users: users.map(transformUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userid", requireAuth, async (req, res, next) => {
  try {
    const userid = Number(req.params.userid);
    if (!Number.isInteger(userid)) {
      return res.status(400).json({ error: "invalid user id" });
    }
    const user = await prisma.user.findUnique({ where: { userid } });
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }
    res.json({ user: transformUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", requireAuth, async (req, res, next) => {
  try {
    const { galleryid, optionid, authinfoid, timestamp } = req.body;
    const parsedGalleryId = Number(galleryid);
    const parsedOptionId = Number(optionid);
    const parsedAuthInfoId = Number(authinfoid);
    if (![parsedGalleryId, parsedOptionId, parsedAuthInfoId].every(Number.isInteger)) {
      return res.status(400).json({ error: "galleryid, optionid, authinfoid must be integers" });
    }
    const userTimestamp = timestamp || new Date().toISOString();
    const user = await prisma.user.create({
      data: {
        galleryid: parsedGalleryId,
        optionid: parsedOptionId,
        authinfoid: parsedAuthInfoId,
        timestamp: userTimestamp,
      },
    });
    res.status(201).json({ user: transformUser(user) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/users/:userid", requireAuth, async (req, res, next) => {
  try {
    const userid = Number(req.params.userid);
    if (!Number.isInteger(userid)) {
      return res.status(400).json({ error: "invalid user id" });
    }
    const data = {};
    if (req.body.galleryid !== undefined) {
      const parsedGalleryId = Number(req.body.galleryid);
      if (!Number.isInteger(parsedGalleryId)) {
        return res.status(400).json({ error: "galleryid must be an integer" });
      }
      data.galleryid = parsedGalleryId;
    }
    if (req.body.optionid !== undefined) {
      const parsedOptionId = Number(req.body.optionid);
      if (!Number.isInteger(parsedOptionId)) {
        return res.status(400).json({ error: "optionid must be an integer" });
      }
      data.optionid = parsedOptionId;
    }
    if (req.body.authinfoid !== undefined) {
      const parsedAuthInfoId = Number(req.body.authinfoid);
      if (!Number.isInteger(parsedAuthInfoId)) {
        return res.status(400).json({ error: "authinfoid must be an integer" });
      }
      data.authinfoid = parsedAuthInfoId;
    }
    if (req.body.timestamp !== undefined) {
      if (typeof req.body.timestamp !== "string" || !req.body.timestamp.trim()) {
        return res.status(400).json({ error: "timestamp must be a non-empty string" });
      }
      data.timestamp = req.body.timestamp;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no valid fields provided" });
    }
    const user = await prisma.user.update({ where: { userid }, data });
    res.json({ user: transformUser(user) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:userid", requireAuth, async (req, res, next) => {
  try {
    const userid = Number(req.params.userid);
    if (!Number.isInteger(userid)) {
      return res.status(400).json({ error: "invalid user id" });
    }
    await prisma.user.delete({ where: { userid } });
    res.json({ message: "user deleted" });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

app.listen(PORT, () => {
  console.log(`memoryMuseum server listening on port ${PORT}`);
});
