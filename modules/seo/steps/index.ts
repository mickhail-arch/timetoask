import type { StepDefinition } from '../types';
import { executeModeration } from './step-1-1-moderation';
import { executeBrief } from './step-1-2-brief';
import { executeModerationHeadings } from './step-2-5-moderation-headings';
import { executeDraft } from './step-3-draft';
import { executeSeoAudit } from './step-4-seo-audit';
import { executeAiDetectRevisions } from './step-5-ai-detect-revisions';
import { executeTargetedRewrite } from './step-5-5-targeted-rewrite';
import { executeImages } from './step-6-images';
import { executeAssembly } from './step-7-assembly';

/**
 * Полный массив шагов пайплайна seo-article-express.
 * Порядок: модерация → ТЗ → [пауза на confirmation] → модерация заголовков →
 *          чистовик → SEO-аудит → AI-детект+правки → картинки → сборка.
 *
 * Шаг 2 (редактирование структуры) — UI-пауза, не входит в массив.
 * Pipeline runner останавливается при requiresConfirmation от шага brief.
 */
export const seoExpressSteps: StepDefinition[] = [
  {
    name: 'moderation',
    displayName: 'Модерация',
    execute: executeModeration,
  },
  {
    name: 'brief',
    displayName: 'Формирование ТЗ',
    execute: executeBrief,
  },
  // -- Пауза: requiresConfirmation → UI шаг 2 → POST /confirm → resume --
  {
    name: 'moderation_headings',
    displayName: 'Модерация заголовков',
    execute: executeModerationHeadings,
  },
  {
    name: 'draft',
    displayName: 'Написание статьи',
    execute: executeDraft,
  },
  {
    name: 'seo_audit',
    displayName: 'Проверка качества',
    execute: executeSeoAudit,
  },
  {
    name: 'ai_detect_revisions',
    displayName: 'Финальные улучшения',
    execute: executeAiDetectRevisions,
  },
  {
    name: 'targeted_rewrite',
    displayName: 'Точечный рерайт',
    execute: executeTargetedRewrite,
  },
  {
    name: 'images',
    displayName: 'Генерация изображений',
    execute: executeImages,
  },
  {
    name: 'assembly',
    displayName: 'Сборка и метаданные',
    execute: executeAssembly,
  },
];

/** Индекс шага, с которого продолжать после confirmation (moderation_headings) */
export const RESUME_FROM_INDEX = 2;
