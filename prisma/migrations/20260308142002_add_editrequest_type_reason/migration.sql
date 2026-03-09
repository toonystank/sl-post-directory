/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "EditRequest" DROP CONSTRAINT "EditRequest_postOfficeId_fkey";

-- AlterTable
ALTER TABLE "EditRequest" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'EDIT',
ALTER COLUMN "postOfficeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "verificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- AddForeignKey
ALTER TABLE "EditRequest" ADD CONSTRAINT "EditRequest_postOfficeId_fkey" FOREIGN KEY ("postOfficeId") REFERENCES "PostOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
