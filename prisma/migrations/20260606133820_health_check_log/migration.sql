-- CreateTable
CREATE TABLE "health_check_log" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "errorMessage" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costRub" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_check_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_check_log_createdAt_idx" ON "health_check_log"("createdAt");
