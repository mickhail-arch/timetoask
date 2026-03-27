-- CreateTable
CREATE TABLE "tool_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "inputParams" JSONB NOT NULL,
    "outputMeta" JSONB,
    "contentText" TEXT,
    "contentUrl" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_sessions_userId_toolId_createdAt_idx" ON "tool_sessions"("userId", "toolId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "tool_sessions" ADD CONSTRAINT "tool_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_sessions" ADD CONSTRAINT "tool_sessions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_sessions" ADD CONSTRAINT "tool_sessions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tool_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
