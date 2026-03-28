// modules/seo/steps/step-5-ai-detect-revisions.ts — AI-детект + правки + повторный детект
import type { StepResult, PipelineContext, SeoIssue, QualityMetrics } from '../types';
import { getStepModel } from '../config';
import { detectAIByCode } from '@/adapters/ai-detection';
import { generateText } from '@/adapters/llm/openrouter.adapter';
import type { ToolConfig } from '@/core/types';

/**
 * Шаг 5: AI-детект + правки (до 2 итераций) + повторный детект (если первый >35%).
 * 5.1 — AI-детект
 * 5.2 — Объединение seo_issues + ai_issues
 * 5.3 — Правки (до 2 итераций) + мини-аудит после каждой
 * 5.4 — Повторный AI-детект (только если 5.1 >35%)
 */
export async function executeAiDetectRevisions(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const config = ctx.config as ToolConfig | null;
  const revisionsModel = getStepModel(config, 'revisions', 'anthropic/claude-opus-4.6');

  // Получить текст статьи из предыдущего шага
  const draftData = ctx.data.draft as Record<string, unknown>
    ?? ctx.data.step_3 as Record<string, unknown>
    ?? {};
  let articleHtml = (draftData.article_html as string) ?? '';

  // Получить brief для правил ревизий
  const confirmationData = ctx.data.confirmation as Record<string, unknown> | undefined;
  const briefData = (confirmationData?.brief ?? ctx.data.brief) as
    { main_keyword: string; lsi_keywords?: string[] } | null ?? null;

  // Получить SEO issues из шага 4
  const auditData = ctx.data.seo_audit as Record<string, unknown>
    ?? ctx.data.step_4 as Record<string, unknown>
    ?? {};
  const seoIssues = (auditData.seo_issues as SeoIssue[]) ?? [];
  let qualityMetrics = (auditData.qualityMetrics as QualityMetrics) ?? {} as QualityMetrics;

  // Получить результаты анализа текста из шага 4.5
  const analysisData = ctx.data.content_analysis as Record<string, unknown> ?? {};
  const writingIssues = (analysisData.writing_issues as Array<{sentence: string; problem: string; fix: string}>) ?? [];
  const factIssues = (analysisData.fact_issues as Array<{claim: string; verdict: string; correction: string | null}>) ?? [];

  // 5.1 — AI-детект (кодовая оценка)
  const plainText = articleHtml.replace(/<[^>]*>/g, '');
  const codeResult = detectAIByCode(plainText);
  const firstAiScore = codeResult.score;

  // 5.2 — Объединение issues
  const aiIssues: SeoIssue[] = codeResult.markers.map((marker, i) => ({
    id: `ai-${i + 1}`,
    group: 'ai_detect',
    severity: 'warning' as const,
    message: marker,
    fix_instruction: `Исправить: ${marker}`,
  }));

  const contentIssues: SeoIssue[] = [];

  for (const wi of writingIssues.slice(0, 10)) {
    contentIssues.push({
      id: `writing-${contentIssues.length + 1}`,
      group: 'writing',
      severity: 'warning' as const,
      message: `[стиль] ${wi.problem}: "${wi.sentence.slice(0, 80)}"`,
      fix_instruction: wi.fix,
    });
  }

  for (const fi of factIssues.filter(f => f.verdict === 'false')) {
    contentIssues.push({
      id: `fact-${contentIssues.length + 1}`,
      group: 'fact_check',
      severity: 'critical' as const,
      message: `[факт] Неверно: "${fi.claim.slice(0, 80)}"`,
      fix_instruction: fi.correction ? `Исправить на: ${fi.correction}` : 'Убрать или перепроверить',
    });
  }

  const allIssues = [
    ...seoIssues.filter(i => i.severity === 'critical'),
    ...contentIssues.filter(i => i.severity === 'critical'),
    ...seoIssues.filter(i => i.severity === 'warning'),
    ...contentIssues.filter(i => i.severity === 'warning'),
    ...aiIssues,
    ...seoIssues.filter(i => i.severity === 'info'),
  ];

  // Ограничение: если > 15 issues — только critical + warning
  const issuesToFix = allIssues.length > 15
    ? allIssues.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0, 15)
    : allIssues.filter(i => i.severity !== 'info');

  // Оригинальные метрики для валидации
  const originalH2Count = (articleHtml.match(/<h2[\s>]/gi) ?? []).length;
  const originalTextLength = articleHtml.replace(/<[^>]*>/g, '').length;
  const originalMarkerCount = (articleHtml.match(/\[IMAGE_\d+\]/g) ?? []).length;
  const criticalSeoIssues = seoIssues.filter(i => i.severity === 'critical');
  const warnings: string[] = [];

  function miniAudit(html: string): boolean {
    const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
    const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
    const textLen = html.replace(/<[^>]*>/g, '').length;
    const markers = (html.match(/\[IMAGE_\d+\]/g) ?? []).length;
    return (
      h1 !== 1 ||
      Math.abs(h2 - originalH2Count) > 1 ||
      textLen < originalTextLength * 0.7 ||
      textLen > originalTextLength * 1.3 ||
      (originalMarkerCount > 0 && markers < originalMarkerCount)
    );
  }

  function buildRevisionsPrompt(
    issues: SeoIssue[],
    input: Record<string, unknown>,
    brief: { main_keyword: string; lsi_keywords?: string[] } | null,
  ): string {
    const mainKeyword = brief?.main_keyword ?? (input.target_query as string) ?? '';
    const keywords = ((input.keywords as string) ?? '').split('\n').filter(Boolean);
    const forbiddenWords = (input.forbidden_words as string) ?? '';

    const rulesBlock = `ПРАВИЛА (нарушение любого = брак):
- Формат: HTML (h1, h2, h3, p). Без strong, em, b, i внутри абзацев.
- Сохрани ВСЕ заголовки H1/H2/H3 — не удаляй, не добавляй, не переименовывай.
- Сохрани ВСЕ маркеры [IMAGE_N] и [IMAGE_N_DESC] на своих местах.
- Объём может измениться не более чем на ±15%.
- FAQ-ответы: 80-150 символов каждый. Если длиннее — сократи.

КЛЮЧЕВЫЕ СЛОВА — не ломать при правках:
- Основной ключ "${mainKeyword}" — должен остаться в H1, первых 300 символах, одном H2, заключении.
- Два ключа в одном предложении — запрещено.
- Ключ в первом слове после заголовка — запрещено.
- Основной ключ в точной форме 2 раза в радиусе 500 символов — запрещено.
${keywords.length > 0 ? `- Дополнительные ключи: ${keywords.join(', ')} — не удалять из текста.` : ''}

АНТИДЕТЕКТ — соблюдать при правках:
- Чередуй короткие (5-10 слов) и длинные (15-25 слов) предложения.
- Каждый абзац начинай с разной конструкции.
- Запрещённые конструкции: «В настоящее время», «Стоит отметить», «Как известно», «На сегодняшний день», «Важно отметить», «Следует подчеркнуть», «Необходимо учитывать», «Таким образом», «Давайте разберёмся», «Не секрет, что», «В современном мире».
${forbiddenWords ? `\nЗАПРЕЩЁННЫЕ СЛОВА (включая морфоформы): ${forbiddenWords}` : ''}`;

    if (issues.length === 0) {
      return `Ты — SEO-редактор. Проведи финальную полировку статьи:
- Улучши 2-3 перехода между разделами.
- Разнообразь начала абзацев (факт/вопрос/пример/число).
- Добавь 1-2 конкретных детали (число, дата, пример).
- Измени не более 5-7% текста.

${rulesBlock}

Верни ТОЛЬКО отредактированный HTML статьи, без пояснений.`;
    }

    const list = issues.map((iss, i) =>
      `${i + 1}. [${iss.severity}] ${iss.message}${iss.fix_instruction ? ` → ${iss.fix_instruction}` : ''}`,
    ).join('\n');

    return `Ты — SEO-редактор. Внеси правки в статью по списку проблем.

ПРОБЛЕМЫ:
${list}

${rulesBlock}

Верни ТОЛЬКО исправленный HTML статьи, без пояснений.`;
  }

  async function executeRevisionIteration(
    currentHtml: string,
    issues: SeoIssue[],
    iterationLabel: string,
  ): Promise<string> {
    const prompt = buildRevisionsPrompt(issues, ctx.input, briefData);
    try {
      const revised = await generateText({
        model: revisionsModel,
        systemPrompt: prompt,
        userMessage: currentHtml,
      });
      const cleanRevised = revised.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();

      const revisedH1 = (cleanRevised.match(/<h1[\s>]/gi) ?? []).length;
      const revisedH2 = (cleanRevised.match(/<h2[\s>]/gi) ?? []).length;
      const revisedText = cleanRevised.replace(/<[^>]*>/g, '');
      const currentText = currentHtml.replace(/<[^>]*>/g, '');
      const revisedMarkers = (cleanRevised.match(/\[IMAGE_\d+\]/g) ?? []).length;
      const currentMarkers = (currentHtml.match(/\[IMAGE_\d+\]/g) ?? []).length;

      const rollback =
        revisedH1 !== 1 ||
        Math.abs(revisedH2 - originalH2Count) > 1 ||
        revisedText.length < currentText.length * 0.7 ||
        revisedMarkers < currentMarkers;

      if (rollback) {
        console.warn(`[step-5] Revision ${iterationLabel} validation failed, rolling back`);
        return currentHtml;
      }
      return cleanRevised;
    } catch (err) {
      console.warn(`[step-5] Revision ${iterationLabel} LLM error, keeping current text:`, err);
      return currentHtml;
    }
  }

  // 5.3 — Правки (до 2 итераций)
  const articleBefore = articleHtml;

  // --- Итерация 1 ---
  articleHtml = await executeRevisionIteration(articleHtml, issuesToFix, 'iteration 1');

  // Мини-аудит после итерации 1
  if (miniAudit(articleHtml) && articleHtml !== articleBefore) {
    articleHtml = articleBefore;
    warnings.push('Правки откачены: нарушена структура');
    console.warn('[step-5] Mini-audit failed after iteration 1, rolled back');
  }

  console.info(`[step-5] Revision iteration 1 done, critical remaining: ${criticalSeoIssues.length}`);

  // 5.4 — Финальный AI-скор
  let finalAiScore = firstAiScore;

  // Обновить qualityMetrics
  qualityMetrics = {
    ...qualityMetrics,
    ai_score: finalAiScore,
  };

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
      winston_problematic_sentences: [],
    },
    durationMs: Date.now() - start,
  };
}
