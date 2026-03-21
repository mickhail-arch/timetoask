// modules/seo/steps/step-5-ai-detect-revisions.ts — AI-детект + правки + повторный детект
import type { StepResult, PipelineContext, SeoIssue, QualityMetrics } from '../types';
import { getStepModel } from '../config';
import { detectAI } from '@/adapters/ai-detection';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import type { ToolConfig } from '@/core/types';

/**
 * Шаг 5: AI-детект + правки (всегда 1 итерация) + повторный детект (если первый >35%).
 * 5.1 — AI-детект
 * 5.2 — Объединение seo_issues + ai_issues
 * 5.3 — Правки (всегда)
 * 5.4 — Повторный AI-детект (только если 5.1 >35%)
 */
export async function executeAiDetectRevisions(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const config = ctx.config as ToolConfig | null;
  const aiModel = getStepModel(config, 'ai_detect', 'anthropic/claude-sonnet-4-5');
  const revisionsModel = getStepModel(config, 'revisions', 'anthropic/claude-sonnet-4-5');

  // Получить текст статьи из предыдущего шага
  const draftData = ctx.data.draft as Record<string, unknown>
    ?? ctx.data.step_3 as Record<string, unknown>
    ?? {};
  let articleHtml = (draftData.article_html as string) ?? '';

  // Получить SEO issues из шага 4
  const auditData = ctx.data.seo_audit as Record<string, unknown>
    ?? ctx.data.step_4 as Record<string, unknown>
    ?? {};
  const seoIssues = (auditData.seo_issues as SeoIssue[]) ?? [];
  let qualityMetrics = (auditData.qualityMetrics as QualityMetrics) ?? {} as QualityMetrics;

  // 5.1 — AI-детект
  const plainText = articleHtml.replace(/<[^>]*>/g, '');
  const aiResult = await detectAI(plainText, aiModel);
  const firstAiScore = aiResult.score;

  // 5.2 — Объединение issues
  const aiIssues: SeoIssue[] = aiResult.markers.map((marker, i) => ({
    id: `ai-${i + 1}`,
    group: 'ai_detect',
    severity: 'warning' as const,
    message: marker,
    fix_instruction: aiResult.fix_instructions[i] ?? 'Переписать для снижения AI-маркеров',
  }));

  const allIssues = [
    ...seoIssues.filter(i => i.severity === 'critical'),
    ...seoIssues.filter(i => i.severity === 'warning'),
    ...aiIssues,
    ...seoIssues.filter(i => i.severity === 'info'),
  ];

  // Ограничение: если > 15 issues — только critical + warning
  const issuesToFix = allIssues.length > 15
    ? allIssues.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0, 15)
    : allIssues.filter(i => i.severity !== 'info');

  // 5.3 — Правки (ВСЕГДА выполняются)
  const issuesList = issuesToFix.length > 0
    ? issuesToFix.map((iss, i) => `${i + 1}. [${iss.severity}] ${iss.message}${iss.fix_instruction ? ` → ${iss.fix_instruction}` : ''}`).join('\n')
    : '';

  const revisionsPrompt = issuesToFix.length > 0
    ? `Ты — SEO-редактор. Внеси правки в статью по списку проблем.

ПРОБЛЕМЫ:
${issuesList}

ПРАВИЛА:
- Исправь каждую проблему из списка.
- НЕ создавай новых проблем (не ставь два ключа в одно предложение, не добавляй AI-маркеры).
- Сохрани все заголовки H1/H2/H3 на месте.
- Сохрани все маркеры [IMAGE_N] и [IMAGE_N_DESC] на месте.
- Объём может измениться не более чем на ±15%.
- Формат: HTML (h1, h2, h3, p, strong, em).

Верни ТОЛЬКО исправленный HTML статьи, без пояснений.`
    : `Ты — SEO-редактор. Проведи финальную полировку статьи:
- Улучши 2–3 перехода между разделами.
- Разнообразь начала абзацев (факт/вопрос/пример).
- Добавь 1–2 конкретных детали (число, дата, пример).
- Измени не более 5–7% текста.
- Сохрани все заголовки H1/H2/H3, маркеры [IMAGE_N], формат HTML.

Верни ТОЛЬКО отредактированный HTML статьи, без пояснений.`;

  const articleBefore = articleHtml;

  try {
    const revised = await generateText({
      model: revisionsModel,
      systemPrompt: revisionsPrompt,
      userMessage: articleHtml,
    });

    // Проверка после правок
    const revisedH1 = (revised.match(/<h1[\s>]/gi) ?? []).length;
    const revisedH2 = (revised.match(/<h2[\s>]/gi) ?? []).length;
    const originalH2 = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
    const revisedText = revised.replace(/<[^>]*>/g, '');
    const originalText = articleHtml.replace(/<[^>]*>/g, '');
    const revisedMarkers = (revised.match(/\[IMAGE_\d+\]/g) ?? []).length;
    const originalMarkers = (articleHtml.match(/\[IMAGE_\d+\]/g) ?? []).length;

    const rollback =
      revisedH1 !== 1 ||
      revisedH2 !== originalH2 ||
      revisedText.length < originalText.length * 0.85 ||
      revisedMarkers < originalMarkers;

    if (rollback) {
      console.warn('[step-5] Revision validation failed, rolling back to original');
    } else {
      articleHtml = revised;
    }
  } catch (err) {
    console.warn('[step-5] Revision LLM error, keeping original text:', err);
  }

  // 5.4 — Повторный AI-детект (только если первый был >35%)
  let finalAiScore = firstAiScore;
  if (firstAiScore > 35) {
    try {
      const recheck = await detectAI(
        articleHtml.replace(/<[^>]*>/g, ''),
        aiModel,
      );
      finalAiScore = recheck.score;
    } catch {
      console.warn('[step-5] Repeat AI-detect failed, keeping first score');
    }
  }

  // Обновить qualityMetrics
  qualityMetrics = {
    ...qualityMetrics,
    ai_score: finalAiScore,
  };

  const warnings: string[] = [];
  if (articleHtml === articleBefore && issuesToFix.length > 0) {
    warnings.push('Правки откачены — использован текст до правок');
  }
  if (finalAiScore > 35) {
    warnings.push(`AI-детект ${finalAiScore}% после правок — рекомендуем проверить вручную`);
  }

  return {
    success: true,
    data: {
      article_html: articleHtml,
      first_ai_score: firstAiScore,
      final_ai_score: finalAiScore,
      issues_fixed: issuesToFix.length,
      qualityMetrics,
      warnings,
      partial: articleHtml.slice(0, 500),
    },
    durationMs: Date.now() - start,
  };
}
