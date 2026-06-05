-- AlterTable
ALTER TABLE "usage_log" ADD COLUMN     "costRub" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "model" TEXT;
