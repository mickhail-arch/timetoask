import { config } from 'dotenv';
config();

import { prisma } from '../lib/prisma';

async function main() {
  const s = await prisma.toolSession.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, contentText: true },
  });
  console.log('id:', s?.id);
  console.log('title:', s?.title);
  console.log('contentText length:', s?.contentText?.length ?? 0);
  console.log('has base64:', s?.contentText?.includes('base64') ?? false);
  console.log('has img tag:', s?.contentText?.includes('<img') ?? false);
  process.exit(0);
}

main().catch(console.error);