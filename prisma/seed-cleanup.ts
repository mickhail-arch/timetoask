import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.tool.deleteMany({
    where: { slug: 'seo-article' },
  });
  console.log(`Deleted ${deleted.count} tool(s) with slug 'seo-article'`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
