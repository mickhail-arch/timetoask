import { PrismaClient } from './generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const tool = await prisma.tool.findUnique({ where: { slug: 'text-rewriter' } });
  if (!tool) { console.log('Already deleted'); return; }
  await prisma.usageLog.deleteMany({ where: { toolId: tool.id } });
  await prisma.chat.deleteMany({ where: { toolId: tool.id } });
  await prisma.jobStep.deleteMany({ where: { toolId: tool.id } });
  await prisma.tool.delete({ where: { id: tool.id } });
  console.log('text-rewriter deleted');
}

main().finally(() => prisma.$disconnect());