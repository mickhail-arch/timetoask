-- DropForeignKey
ALTER TABLE "usage_log" DROP CONSTRAINT "usage_log_toolId_fkey";

-- AlterTable
ALTER TABLE "usage_log" ALTER COLUMN "toolId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "usage_log" ADD CONSTRAINT "usage_log_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
