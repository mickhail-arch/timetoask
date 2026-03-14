// prisma/seed.ts
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting seed...');

  // ─── 1. План Free ───────────────────────────────────────────────
  // Единственный план. Нет Pro и нет подписок.
  // Пользователь просто пополняет баланс токенами через ЮKassa.
  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    update: {},
    create: {
      slug: 'free',
      name: 'Бесплатный',
      tokensIncluded: 0,   // стартовые токены при регистрации задаются через env FREE_TOKENS_ON_REGISTER
      price: 0,
      isActive: true,
    },
  });

  console.log(`✅ Plan created: ${freePlan.name} (${freePlan.slug})`);

  // ─── 2. Admin-аккаунт ────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin1234!';

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn(
      '⚠️  ADMIN_EMAIL / ADMIN_PASSWORD не заданы в .env — используются дефолтные значения. Смените пароль после первого входа!'
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash,
      role: 'admin',
      emailVerified: new Date(),
      balance: {
        create: {
          amount: 999999,
          reserved: 0,
        },
      },
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // ─── 3. Тестовый инструмент (disabled) ──────────────────────────
  // Инструменты обычно регистрируются через ToolRegistry.initialize()
  // при старте приложения из папки plugins/.
  // Здесь — только пример, чтобы БД не была пустой.
  const exampleTool = await prisma.tool.upsert({
    where: { slug: 'text-rewriter' },
    update: {},
    create: {
      slug: 'text-rewriter',
      name: 'Рерайтер текста',
      description: 'Переписывает текст в нужном тоне',
      model: 'openai/gpt-4o-mini',
      promptText: 'Ты профессиональный редактор. Перепиши текст в указанном тоне.',
      status: 'disabled',
      executionMode: 'sync',
      tokenCost: 50,
      freeUsesLimit: 5,
    },
  });

  console.log(`✅ Tool created: ${exampleTool.name} (${exampleTool.status})`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('─────────────────────────────────');
  console.log(`   Plan : ${freePlan.name}`);
  console.log(`   Admin: ${admin.email}`);
  console.log('─────────────────────────────────');
  console.log('⚠️  Не забудь сменить пароль админа после первого входа!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });