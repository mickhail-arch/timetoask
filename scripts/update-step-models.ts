/**
 * Смена LLM-моделей по шагам пайплайна SEO-генератора.
 * Обновляет config.models в таблице tools (slug: seo-article-express).
 * Registry подхватит изменения автоматически через 30 сек (кеш).
 *
 * Использование:
 *   npx tsx scripts/update-step-models.ts step=model [step=model ...]
 *
 * Примеры:
 *   npx tsx scripts/update-step-models.ts draft=anthropic/claude-sonnet-4
 *   npx tsx scripts/update-step-models.ts brief=anthropic/claude-sonnet-4 draft=anthropic/claude-sonnet-4
 *   npx tsx scripts/update-step-models.ts draft=anthropic/claude-opus-4.6   # откат
 *
 * Допустимые шаги:
 *   brief, draft, assembly, ai_detect, revisions,
 *   image_gen, moderation, image_prompt, moderation_headings
 */

import { config } from 'dotenv';
config();

const VALID_STEPS = [
  'brief',
  'draft',
  'assembly',
  'ai_detect',
  'revisions',
  'image_gen',
  'moderation',
  'image_prompt',
  'moderation_headings',
] as const;

type StepName = (typeof VALID_STEPS)[number];

const TOOL_SLUG = 'seo-article-express';

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/update-step-models.ts <step>=<model> [<step>=<model> ...]

Examples:
  npx tsx scripts/update-step-models.ts draft=anthropic/claude-sonnet-4
  npx tsx scripts/update-step-models.ts brief=anthropic/claude-sonnet-4 draft=anthropic/claude-sonnet-4
  npx tsx scripts/update-step-models.ts draft=anthropic/claude-opus-4.6

Valid steps: ${VALID_STEPS.join(', ')}`);
}

function parseArgs(argv: string[]): Record<StepName, string> {
  const raw = argv.slice(2);

  if (raw.length === 0) {
    printUsage();
    process.exit(0);
  }

  const updates: Record<string, string> = {};

  for (const arg of raw) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx === -1) {
      console.error(`Invalid argument format: "${arg}". Expected key=value.`);
      process.exit(1);
    }

    const key = arg.slice(0, eqIdx);
    const value = arg.slice(eqIdx + 1);

    if (!VALID_STEPS.includes(key as StepName)) {
      console.error(
        `Unknown step "${key}". Valid steps: ${VALID_STEPS.join(', ')}`,
      );
      process.exit(1);
    }

    if (!value) {
      console.error(`Empty model value for step "${key}".`);
      process.exit(1);
    }

    updates[key] = value;
  }

  return updates as Record<StepName, string>;
}

async function main() {
  const updates = parseArgs(process.argv);

  const { prisma } = await import('@/lib/prisma');

  try {
    const tool = await prisma.tool.findUnique({ where: { slug: TOOL_SLUG } });

    if (!tool) {
      console.error(`Tool "${TOOL_SLUG}" not found in DB.`);
      process.exit(1);
    }

    const cfg = (tool.config ?? {}) as Record<string, unknown>;
    const models = ((cfg.models as Record<string, string>) ?? {});

    for (const [step, newModel] of Object.entries(updates)) {
      const oldModel = models[step] ?? '(not set)';
      console.log(`${step}: ${oldModel} -> ${newModel}`);
      models[step] = newModel;
    }

    cfg.models = models;

    await prisma.tool.update({
      where: { slug: TOOL_SLUG },
      data: { config: cfg as any },
    });

    console.log('\nUpdated config.models:');
    console.log(JSON.stringify(models, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
