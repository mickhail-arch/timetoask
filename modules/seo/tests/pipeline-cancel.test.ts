// modules/seo/tests/pipeline-cancel.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/redis', () => ({
  redis: {
    exists: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobStep: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    toolSession: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/modules/billing/billing.service', () => ({
  rollbackTokens: vi.fn().mockResolvedValue(undefined),
  finalizeTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../pricing', () => ({
  calculatePrice: vi.fn().mockReturnValue({
    base: 0, chars: 10, images: 0, faq: 0,
    multiplier: 3, totalBeforeMultiplier: 10,
    total: 100, analysisCost: 15,
  }),
}));

import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { rollbackTokens } from '@/modules/billing/billing.service';
import { runPipeline, regeneratePipeline } from '../pipeline';
import type { StepDefinition, BriefData } from '../types';

const JOB_ID = 'test-job-cancel-001';
const USER_ID = 'user-test-001';
const ANALYSIS_COST = 50;
const REGENERATE_COST = 80;

const TX_MOCK = {};

const MINIMAL_BRIEF: BriefData = {
  h1: 'Test Article',
  h2_list: [],
  subtopics: [],
  lsi_keywords: [],
  main_keyword: 'test',
  main_keyword_min: 1,
  main_keyword_max: 3,
  keys_per_section: 2,
  brand_mentions: 0,
  geo_mentions: 0,
  table_topic: '',
  table_after_h2: 0,
  case_topic: '',
  callout_count: 0,
  citation_count: 0,
  faq_count_eeat: 0,
  toc_enabled: false,
  intro_chars: 0,
  tldr_chars: 0,
  table_chars: 0,
  case_chars: 0,
  conclusion_chars: 0,
  faq_chars: 0,
};

describe('pipeline cancel and missing-state behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: object) => Promise<void>) => fn(TX_MOCK),
    );
  });

  describe('runPipeline — cancel-флаг выставлен до первого шага', () => {
    it('не вызывает step.execute, помечает jobStep failed и вызывает rollbackTokens с analysisCost', async () => {
      (redis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const stepExecute = vi.fn();
      const steps: StepDefinition[] = [
        { name: 'moderation', displayName: 'Модерация', execute: stepExecute },
      ];

      await runPipeline(JOB_ID, USER_ID, {}, null, steps, ANALYSIS_COST);

      expect(stepExecute).not.toHaveBeenCalled();

      const updateCalls = (prisma.jobStep.update as ReturnType<typeof vi.fn>).mock.calls;
      expect(updateCalls.some(([arg]) => arg?.data?.status === 'failed')).toBe(true);

      expect(rollbackTokens).toHaveBeenCalledWith(
        USER_ID,
        ANALYSIS_COST,
        expect.anything(),
        `seo-analysis:${USER_ID}:${JOB_ID}`,
      );
    });
  });

  describe('regeneratePipeline — Redis-состояние отсутствует', () => {
    it('вызывает rollbackTokens с regenerateCost и бросает ошибку', async () => {
      (redis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const steps: StepDefinition[] = [
        {
          name: 'moderation_headings',
          displayName: 'Модерация заголовков',
          execute: vi.fn(),
        },
      ];

      await expect(
        regeneratePipeline(
          JOB_ID,
          USER_ID,
          MINIMAL_BRIEF,
          null,
          null,
          steps,
          REGENERATE_COST,
        ),
      ).rejects.toThrow('Job state not found in Redis');

      expect(rollbackTokens).toHaveBeenCalledWith(
        USER_ID,
        REGENERATE_COST,
        expect.anything(),
        `seo-regenerate:${USER_ID}:${JOB_ID}`,
      );
    });
  });
});
