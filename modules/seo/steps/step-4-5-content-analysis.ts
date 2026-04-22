// modules/seo/steps/step-4-5-content-analysis.ts — Анализ стиля + фактчек (1 вызов)
import type { StepResult, PipelineContext } from '../types';
import { generateText } from '@/adapters/llm/openrouter.adapter';

interface WritingIssue {
  sentence: string;
  problem: string;
  fix: string;
}

interface FactIssue {
  claim: string;
  verdict: 'true' | 'false' | 'unverified';
  correction: string | null;
}

interface AnalysisResult {
  writing_issues: WritingIssue[];
  fact_issues: FactIssue[];
}

const CONTENT_ANALYSIS_PROMPT = `Проанализируй текст статьи на русском языке. Выполни две задачи:

ЗАДАЧА 1 — АНАЛИЗ СТИЛЯ:
Найди: канцеляризмы ("стоит отметить", "важно подчеркнуть", "в настоящее время" и подобные), абзацы с одинаковой структурой, места без конкретики (нет чисел/примеров), шаблонные переходы ("Давайте рассмотрим", "Перейдём к"), водянистые предложения без информации.

ЗАДАЧА 2 — ПРОВЕРКА ФАКТОВ:
Проверь все цифры, даты, проценты, названия законов, статистику, названия компаний. Для каждого факта оцени: true (верно), false (неверно), unverified (нельзя проверить). Если false — укажи правильное значение.

Верни ТОЛЬКО валидный JSON без markdown:
{
  "writing_issues": [{"sentence": "цитата", "problem": "тип проблемы", "fix": "рекомендация"}],
  "fact_issues": [{"claim": "цитата утверждения", "verdict": "true|false|unverified", "correction": "правильное значение или null"}]
}

Максимум 15 writing_issues и 20 fact_issues. Если проблем нет — пустые массивы.`;

function parseAnalysisResult(raw: string): AnalysisResult {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      writing_issues: Array.isArray(parsed.writing_issues) ? parsed.writing_issues : [],
      fact_issues: Array.isArray(parsed.fact_issues) ? parsed.fact_issues : [],
    };
  } catch {
    return { writing_issues: [], fact_issues: [] };
  }
}

export async function executeContentAnalysis(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const analysisModelChoice = (ctx.input.analysis_model as string) ?? 'sonnet';
  const ANALYSIS_MODEL_MAP: Record<string, string> = {
    sonnet: 'anthropic/claude-sonnet-4.6',
    opus47: 'anthropic/claude-opus-4-7',
  };
  const model = ANALYSIS_MODEL_MAP[analysisModelChoice] ?? ANALYSIS_MODEL_MAP.sonnet;

  const draftData = ctx.data.draft as Record<string, unknown>
    ?? ctx.data.step_3 as Record<string, unknown>
    ?? {};
  const articleHtml = (draftData.article_html as string) ?? '';
  const plainText = articleHtml.replace(/<[^>]*>/g, '');

  const raw = await generateText({
    model,
    systemPrompt: CONTENT_ANALYSIS_PROMPT,
    userMessage: plainText,
  });

  const { writing_issues: writingIssues, fact_issues: factIssues } = parseAnalysisResult(raw);

  console.info(
    `[step-4.5] Writing issues: ${writingIssues.length}, Fact issues: ${factIssues.length}`,
  );

  return {
    success: true,
    data: {
      writing_issues: writingIssues,
      fact_issues: factIssues,
      skipped: false,
    },
    durationMs: Date.now() - start,
  };
}
