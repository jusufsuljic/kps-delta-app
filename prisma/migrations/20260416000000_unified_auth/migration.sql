-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SHOOTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SetupCodePurpose" AS ENUM ('ONBOARDING', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'SHOOTER',
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedByUserId" TEXT,
    "passwordResetRequestId" TEXT,
    "purpose" "SetupCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSuffix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SetupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_userId_status_createdAt_idx" ON "PasswordResetRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_createdAt_idx" ON "PasswordResetRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetupCode_passwordResetRequestId_key" ON "SetupCode"("passwordResetRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SetupCode_codeHash_key" ON "SetupCode"("codeHash");

-- CreateIndex
CREATE INDEX "SetupCode_userId_createdAt_idx" ON "SetupCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SetupCode_userId_expiresAt_idx" ON "SetupCode"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "SetupCode_usedAt_idx" ON "SetupCode"("usedAt");

-- CreateIndex
CREATE INDEX "SetupCode_revokedAt_idx" ON "SetupCode"("revokedAt");

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCode" ADD CONSTRAINT "SetupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCode" ADD CONSTRAINT "SetupCode_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCode" ADD CONSTRAINT "SetupCode_passwordResetRequestId_fkey" FOREIGN KEY ("passwordResetRequestId") REFERENCES "PasswordResetRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
