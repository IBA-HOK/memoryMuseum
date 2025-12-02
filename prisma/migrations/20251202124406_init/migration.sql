-- CreateTable
CREATE TABLE "User" (
    "userid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "galleryid" INTEGER NOT NULL,
    "optionid" INTEGER NOT NULL,
    "authinfoid" INTEGER NOT NULL,
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "User_galleryid_fkey" FOREIGN KEY ("galleryid") REFERENCES "Gallery" ("galleryid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_optionid_fkey" FOREIGN KEY ("optionid") REFERENCES "Option" ("optionid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_authinfoid_fkey" FOREIGN KEY ("authinfoid") REFERENCES "AuthInfo" ("authinfoid") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthInfo" (
    "authinfoid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hashedpass" TEXT NOT NULL,
    "userdecidedid" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Option" (
    "optionid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "Gallery" (
    "galleryid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artids" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "Art" (
    "artid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_galleryid_key" ON "User"("galleryid");

-- CreateIndex
CREATE UNIQUE INDEX "User_optionid_key" ON "User"("optionid");

-- CreateIndex
CREATE UNIQUE INDEX "User_authinfoid_key" ON "User"("authinfoid");

-- CreateIndex
CREATE UNIQUE INDEX "AuthInfo_userdecidedid_key" ON "AuthInfo"("userdecidedid");
