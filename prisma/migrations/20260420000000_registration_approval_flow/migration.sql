-- CreateEnum
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "emailNormalized" TEXT;

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullNameNormalized" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "approvedUserId" TEXT,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_emailNormalized_key" ON "RegistrationRequest"("emailNormalized");

-- CreateIndex
CREATE INDEX "RegistrationRequest_status_createdAt_idx" ON "RegistrationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationRequest_fullNameNormalized_status_idx" ON "RegistrationRequest"("fullNameNormalized", "status");

-- CreateIndex
CREATE INDEX "RegistrationRequest_approvedUserId_idx" ON "RegistrationRequest"("approvedUserId");

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_approvedUserId_fkey" FOREIGN KEY ("approvedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
