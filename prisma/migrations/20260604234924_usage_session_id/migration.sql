-- AlterTable
ALTER TABLE "usage_log" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "usage_log_sessionId_idx" ON "usage_log"("sessionId");
