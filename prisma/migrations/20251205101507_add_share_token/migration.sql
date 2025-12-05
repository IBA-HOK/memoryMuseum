/*
  Warnings:

  - A unique constraint covering the columns `[share_token]` on the table `Art` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Art" ADD COLUMN "share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Art_share_token_key" ON "Art"("share_token");
