-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleId" TEXT;

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "guestUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_tokenHash_key" ON "magic_link_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_email_idx" ON "magic_link_tokens"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

