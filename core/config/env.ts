// core/config/env.ts — Zod-validated environment configuration
import { z } from 'zod';

const envSchema = z.object({
  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('MarketingAI'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional().default(''),

  // LLM
  LLM_PROVIDER: z.string().default('openrouter'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_FALLBACK_MODEL: z.string().default('openrouter/auto'),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),

  // Payments (YuKassa)
  YOKASSA_SHOP_ID: z.string().optional().default(''),
  YOKASSA_SECRET_KEY: z.string().optional().default(''),
  YOKASSA_WEBHOOK_SECRET: z.string().optional().default(''),
  YOKASSA_RETURN_URL: z.string().url().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('noreply@example.com'),

  // Monitoring
  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_AUTH_TOKEN: z.string().optional().default(''),

  // Concurrency
  MAX_CONCURRENT_GLOBAL: z.coerce.number().int().default(20),
  MAX_CONCURRENT_PER_USER: z.coerce.number().int().default(2),
  MAX_CONCURRENT_ASYNC: z.coerce.number().int().default(5),
  MAX_EXECUTION_TIMEOUT_MS: z.coerce.number().int().default(120_000),

  // Billing defaults
  TOOL_TOKEN_COST: z.coerce.number().int().default(100),
  FREE_TOKENS_ON_REGISTER: z.coerce.number().int().default(300),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().default(60),

  // AI Detection (Winston AI)
  WINSTON_API_KEY: z.string().optional().default(''),

  // Search
  SERPER_API_KEY: z.string().optional().default(''),
  SERPAPI_KEY: z.string().optional().default(''),

  // Admin seed
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env: Readonly<Env> = Object.freeze(result.data);
