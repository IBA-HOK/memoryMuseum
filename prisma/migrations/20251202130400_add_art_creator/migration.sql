/*
  Warnings:

  - Added the required column `creatorid` to the `Art` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Art" (
    "artid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "creatorid" INTEGER NOT NULL,
    CONSTRAINT "Art_creatorid_fkey" FOREIGN KEY ("creatorid") REFERENCES "User" ("userid") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Art" ("artid", "path", "timestamp") SELECT "artid", "path", "timestamp" FROM "Art";
DROP TABLE "Art";
ALTER TABLE "new_Art" RENAME TO "Art";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
