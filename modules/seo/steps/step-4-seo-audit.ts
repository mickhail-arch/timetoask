import type { StepResult, PipelineContext, QualityMetrics, SeoIssue } from '../types';

/**
 * Шаг 4: SEO-аудит.
 * Код парсит article_html, проверяет по всем измеримым правилам wrapper_rules.
 * Возвращает seo_issues[] + qualityMetrics для панели качества.
 */
export async function executeSeoAudit(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const draftData = ctx.data.draft as Record<string, unknown>
    ?? ctx.data.step_3 as Record<string, unknown>
    ?? {};
  const html = (draftData.article_html as string) ?? '';
  const text = html.replace(/<[^>]*>/g, '');
  const input = ctx.input;
  const targetQuery = (input.target_query as string) ?? '';
  const keywords = (input.keywords as string) ?? '';
  const targetChars = (input.target_char_count as number) ?? 8000;
  const imageCount = (input.image_count as number) ?? 0;
  const faqCount = (input.faq_count as number) ?? 0;
  const forbiddenWords = ((input.forbidden_words as string) ?? '')
    .split('\n').map(w => w.trim().toLowerCase()).filter(Boolean);

  const issues: SeoIssue[] = [];
  let issueId = 0;
  const addIssue = (group: string, severity: SeoIssue['severity'], message: string, fix?: string) => {
    issues.push({ id: `${group}-${++issueId}`, group, severity, message, fix_instruction: fix });
  };

  // --- Структура ---
  const h1s = html.match(/<h1[\s>][\s\S]*?<\/h1>/gi) ?? [];
  const h2s = html.match(/<h2[\s>][\s\S]*?<\/h2>/gi) ?? [];
  const h3s = html.match(/<h3[\s>][\s\S]*?<\/h3>/gi) ?? [];

  if (h1s.length !== 1) addIssue('structure', 'critical', `H1: найдено ${h1s.length}, ожидается 1`, 'Оставить ровно один H1');

  const expectedH2Min = Math.max(1, Math.floor(targetChars / 2000));
  const expectedH2Max = Math.ceil(targetChars / 1500);
  if (h2s.length < expectedH2Min) addIssue('structure', 'warning', `H2: ${h2s.length}, мало для ${targetChars} символов (мин ${expectedH2Min})`, 'Добавить разделы H2');
  if (h2s.length > expectedH2Max + 2) addIssue('structure', 'warning', `H2: ${h2s.length}, много для ${targetChars} символов`, 'Убрать лишние H2');

  const charCount = text.length;
  if (charCount < targetChars * 0.9) addIssue('structure', 'warning', `Объём ${charCount} символов, ожидается ~${targetChars} (±10%)`, 'Дополнить текст');
  if (charCount > targetChars * 1.1) addIssue('structure', 'warning', `Объём ${charCount} символов, превышает ${targetChars} на >10%`, 'Сократить текст');

  // --- Основной ключ ---
  const mainKeyword = targetQuery.length <= 30 ? targetQuery.toLowerCase() : targetQuery.toLowerCase().split(' ').slice(0, 4).join(' ');
  const textLower = text.toLowerCase();
  const keywordRegex = new RegExp(mainKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const keywordMatches = text.match(keywordRegex) ?? [];
  const keywordCount = keywordMatches.length;
  const density = charCount > 0 ? (keywordCount * mainKeyword.length / charCount) * 100 : 0;

  if (density < 0.5) addIssue('keyword', 'critical', `Плотность основного ключа ${density.toFixed(2)}% (мин 0.5%)`, 'Добавить вхождения ключа');
  if (density > 1.5) addIssue('keyword', 'warning', `Плотность основного ключа ${density.toFixed(2)}% (макс 1.5%)`, 'Убрать лишние вхождения');

  const first300 = textLower.slice(0, 300);
  if (!first300.includes(mainKeyword)) addIssue('keyword', 'critical', 'Основной ключ не в первых 300 символах', 'Добавить ключ в начало текста');

  if (h1s.length > 0 && !h1s[0].toLowerCase().includes(mainKeyword)) {
    addIssue('keyword', 'critical', 'Основной ключ отсутствует в H1', 'Добавить ключ в H1');
  }

  // --- Доп. ключи ---
  const keywordList = keywords.split('\n').map(k => k.trim().toLowerCase()).filter(Boolean);
  for (const kw of keywordList) {
    const kwRegex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const kwCount = (text.match(kwRegex) ?? []).length;
    if (kwCount === 0) addIssue('keywords', 'warning', `Доп. ключ "${kw}" не найден в тексте`, `Добавить 1-2 вхождения "${kw}"`);
  }

  // --- Картинки ---
  const imgTags = html.match(/<img[\s>]/gi) ?? [];
  const imgAlts = html.match(/<img[^>]*alt="[^"]+"/gi) ?? [];
  if (imageCount > 0 && imgTags.length === 0) {
    const markers = html.match(/\[IMAGE_\d+\]/g) ?? [];
    if (markers.length < imageCount) addIssue('images', 'warning', `Маркеров изображений ${markers.length}, ожидается ${imageCount}`, 'Добавить маркеры [IMAGE_N]');
  }

  // --- FAQ ---
  const faqH2 = html.match(/<h2[^>]*>.*(?:FAQ|часто задаваемые|вопрос).*<\/h2>/gi) ?? [];
  if (faqCount > 0 && faqH2.length === 0) addIssue('faq', 'warning', 'FAQ-блок не найден', 'Добавить H2 с FAQ');

  // --- Запрещённые слова ---
  for (const fw of forbiddenWords) {
    if (textLower.includes(fw)) addIssue('forbidden', 'critical', `Запрещённое слово "${fw}" найдено в тексте`, `Удалить "${fw}" из текста`);
  }

  // --- Качество текста ---
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Заспамленность
  const wordFreq: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3) wordFreq[wl] = (wordFreq[wl] ?? 0) + 1;
  }
  const totalSignificant = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  const repeatedWords = Object.values(wordFreq).filter(c => c > 2).reduce((a, b) => a + b, 0);
  const spam = totalSignificant > 0 ? Math.round((repeatedWords / totalSignificant) * 100) : 0;

  // Водность
  const stopWords = ['и', 'в', 'на', 'с', 'по', 'для', 'от', 'из', 'к', 'не', 'что', 'это', 'как', 'но', 'а', 'то', 'все', 'при', 'так', 'его', 'она', 'они', 'мы', 'вы', 'же', 'бы', 'да', 'нет', 'уже', 'или', 'ни', 'быть', 'был', 'может', 'более', 'также', 'свой', 'после', 'этот', 'один', 'такой'];
  const stopCount = words.filter(w => stopWords.includes(w.toLowerCase())).length;
  const water = wordCount > 0 ? Math.round((stopCount / wordCount) * 100) : 0;

  // Тошнота классическая
  const maxFreq = Math.max(...Object.values(wordFreq), 0);
  const nauseaClassic = Math.round(Math.sqrt(maxFreq) * 10) / 10;

  // Тошнота академическая
  const nauseaAcademic = totalSignificant > 0
    ? Math.round((maxFreq / totalSignificant) * 1000) / 10
    : 0;

  // Читабельность
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 25).length;
  const stopConstructions = ['в настоящее время', 'стоит отметить', 'как известно', 'на сегодняшний день', 'важно отметить', 'следует подчеркнуть', 'необходимо учитывать', 'таким образом', 'давайте разберёмся'];
  const stopHits = stopConstructions.filter(sc => textLower.includes(sc)).length;
  let readability = 10 - (longSentences * 0.3) - (stopHits * 0.5) - (water > 25 ? 1 : 0);
  readability = Math.max(1, Math.min(10, Math.round(readability * 10) / 10));

  // Уникальность (приблизительная оценка на основе разнообразия лексики)
  const uniqueWords = Object.keys(wordFreq).length;
  const uniqueness = wordCount > 0 ? Math.min(98, Math.round((uniqueWords / wordCount) * 200)) : 85;

  if (spam > 60) addIssue('quality', 'warning', `Заспамленность ${spam}% (макс 60%)`, 'Разнообразить лексику');
  if (water > 25) addIssue('quality', 'warning', `Водность ${water}% (макс 25%)`, 'Убрать стоп-слова');
  if (nauseaClassic > 8) addIssue('quality', 'warning', `Классическая тошнота ${nauseaClassic} (макс 8)`, 'Снизить частоту повторяющегося слова');
  if (readability < 6) addIssue('quality', 'warning', `Читабельность ${readability} (мин 6)`, 'Упростить предложения');

  for (const sc of stopConstructions) {
    if (textLower.includes(sc)) addIssue('quality', 'info', `Стоп-конструкция: "${sc}"`, `Переписать без "${sc}"`);
  }

  const qualityMetrics: QualityMetrics = {
    ai_score: 0,
    water,
    spam,
    nausea_classic: nauseaClassic,
    nausea_academic: nauseaAcademic,
    uniqueness,
    readability,
    char_count: charCount,
    word_count: wordCount,
    h2_count: h2s.length,
    h3_count: h3s.length,
    image_count: imgTags.length || (html.match(/\[IMAGE_\d+\]/g) ?? []).length,
    faq_count: faqH2.length,
  };

  return {
    success: true,
    data: {
      seo_issues: issues,
      qualityMetrics,
      critical_count: issues.filter(i => i.severity === 'critical').length,
      warning_count: issues.filter(i => i.severity === 'warning').length,
    },
    durationMs: Date.now() - start,
  };
}
