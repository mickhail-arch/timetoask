import type { StepResult, PipelineContext, QualityMetrics, SeoIssue } from '../types';

// ─── Словарь водных слов (300+ записей, разделённых по категориям) ───────────

const WATER_WORDS = {
  /** Вводные/пустые (вес 1.0) */
  introductory: new Set([
    'также', 'кроме', 'более', 'менее', 'очень', 'достаточно', 'довольно',
    'весьма', 'вполне', 'просто', 'именно', 'даже', 'уже', 'ещё', 'еще',
    'только', 'лишь', 'всего', 'вообще', 'конечно', 'безусловно', 'разумеется',
    'несомненно', 'естественно', 'действительно', 'определённо', 'наверное',
    'возможно', 'вероятно', 'пожалуй', 'видимо', 'впрочем', 'однако',
    'причём', 'притом', 'зато', 'следовательно', 'соответственно',
    'буквально', 'практически', 'фактически', 'собственно', 'непосредственно',
    'исключительно', 'преимущественно', 'принципиально', 'существенно',
    'значительно', 'несколько', 'примерно', 'приблизительно', 'около', 'порядка',
    'ведь', 'тоже', 'хоть', 'якобы', 'будто', 'наконец', 'кажется',
    'напротив', 'наоборот', 'опять', 'снова', 'вновь', 'немного', 'слегка',
    'чуть', 'неужели', 'разве', 'бесспорно', 'поистине', 'мол', 'дескать', 'небось',
  ]),

  /** Канцеляризмы/штампы (вес 1.0) */
  bureaucratic: new Set([
    'является', 'являются', 'данный', 'данная', 'данное', 'данные',
    'осуществлять', 'осуществляет', 'осуществление',
    'обеспечивать', 'обеспечивает', 'обеспечение',
    'представляет', 'представлять', 'представляется',
    'реализация', 'реализовать', 'функционирование', 'функционировать',
    'формирование', 'формировать', 'использование',
    'производить', 'производится', 'характеризуется',
    'обусловлен', 'обусловлено', 'свидетельствует',
    'подразумевает', 'предполагает', 'способствует', 'содействует',
    'затрагивает', 'регламентирует', 'оптимизирует',
    'актуальный', 'актуальная', 'актуальное', 'релевантный',
    'комплексный', 'системный', 'эффективный', 'эффективность',
    'оперативный', 'приоритетный', 'ключевой', 'базовый', 'основополагающий',
    'вышеуказанный', 'вышеупомянутый', 'нижеследующий', 'нижеизложенный',
    'соответствующий', 'надлежащий', 'аналогичный', 'сопоставимый',
    'целесообразный', 'целесообразно', 'обязательный',
    'регулирование', 'координация', 'систематизация', 'информирование',
    'задействовать', 'оптимизация', 'минимизация',
    'нижеперечисленный', 'вышеперечисленный', 'незамедлительно',
    'подлежит', 'посредством', 'обозначенный', 'указанный', 'упомянутый',
    'именуемый', 'касательно', 'применительно', 'вследствие',
    'специфика', 'нормативный', 'имплементация', 'верификация',
    'унификация', 'пролонгация', 'детерминирует',
    'модернизация', 'диверсификация',
  ]),

  /** Усилители/ослабители (вес 1.0) */
  amplifiers: new Set([
    'абсолютно', 'совершенно', 'полностью', 'максимально', 'крайне',
    'чрезвычайно', 'невероятно', 'особенно', 'наиболее', 'наименее',
    'отчасти', 'частично', 'относительно', 'сравнительно', 'условно',
    'потенциально', 'теоретически', 'гипотетически',
    'предельно', 'безмерно', 'колоссально', 'катастрофически',
    'поразительно', 'удивительно', 'немыслимо', 'несказанно',
    'безгранично', 'непомерно', 'неимоверно', 'запредельно',
    'ужасно', 'страшно',
  ]),

  /** Связки-паразиты — одиночные слова (вес 1.0) */
  parasiteWords: new Set([
    'кстати', 'собственно', 'допустим', 'скажем', 'положим', 'словом',
    'короче', 'грубо', 'мягко', 'условно', 'образно', 'иначе',
    'точнее', 'вернее', 'скорее', 'быстрее', 'проще', 'сложнее',
    'соответственно', 'следовательно', 'итак',
    'значит', 'далее', 'затем', 'впоследствии', 'однозначно',
    'заметьте', 'видите', 'знаете', 'понимаете', 'послушайте',
  ]),

  /** Связки-паразиты — многословные фразы (вес 1.0, поиск подстрокой) */
  parasitePhrases: [
    'таким образом', 'в целом', 'по сути', 'по факту', 'в принципе',
    'в частности', 'в основном', 'в общем', 'в итоге', 'в результате',
    'в конечном счёте', 'в первую очередь', 'в свою очередь',
    'в то же время', 'в настоящее время', 'на самом деле',
    'на сегодняшний день', 'по большому счёту', 'тем не менее',
    'между тем', 'помимо этого', 'кроме того', 'более того',
    'вместе с тем', 'стоит отметить', 'важно подчеркнуть',
    'необходимо учитывать', 'следует отметить', 'нужно сказать',
    'хочется отметить', 'нельзя не отметить',
    'как бы то ни было', 'так или иначе', 'в конце концов',
    'в той или иной степени', 'в некотором смысле', 'в значительной степени',
    'с другой стороны', 'с одной стороны', 'как правило',
    'по крайней мере', 'по меньшей мере', 'в конечном итоге',
    'в любом случае', 'в данном случае', 'прежде всего',
    'без сомнения', 'по всей видимости', 'само собой',
    'в определённом смысле',
  ],

  /** Местоимения (половинный вес = 0.5) */
  pronouns: new Set([
    'он', 'она', 'оно', 'они', 'мы', 'вы', 'его', 'её', 'их',
    'наш', 'ваш', 'свой', 'этот', 'тот', 'такой', 'какой',
    'весь', 'все', 'каждый', 'сам', 'себя', 'некоторый', 'некий',
    'любой', 'иной', 'другой', 'прочий',
    'нечто', 'ничто', 'некого', 'никого', 'нечего', 'ничего',
    'чей', 'всякий', 'оба', 'обе',
  ]),
};

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
  const h1s: string[] = html.match(/<h1[\s>][\s\S]*?<\/h1>/gi) ?? [];
  const h2s: string[] = html.match(/<h2[\s>][\s\S]*?<\/h2>/gi) ?? [];
  const h3s: string[] = html.match(/<h3[\s>][\s\S]*?<\/h3>/gi) ?? [];

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
  const keywordCount = (text.match(keywordRegex) ?? []).length;
  const density = charCount > 0 ? (keywordCount * mainKeyword.length / charCount) * 100 : 0;

  if (density < 0.5) addIssue('keyword', 'critical', `Плотность основного ключа ${density.toFixed(2)}% (мин 0.5%)`, 'Добавить вхождения ключа');
  if (density > 1.5) addIssue('keyword', 'warning', `Плотность основного ключа ${density.toFixed(2)}% (макс 1.5%)`, 'Убрать лишние вхождения');

  const first300 = textLower.slice(0, 300);
  if (!first300.includes(mainKeyword)) addIssue('keyword', 'critical', 'Основной ключ не в первых 300 символах', 'Добавить ключ в начало текста');

  if (h1s.length > 0 && !h1s[0].replace(/<[^>]*>/g, '').toLowerCase().includes(mainKeyword)) {
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
  const faqSectionMatch = html.match(/<h2[^>]*>.*?(?:FAQ|часто задаваемые|вопрос)[\s\S]*?(?=<h2[\s>]|$)/i);
  const faqH3Count = faqSectionMatch ? (faqSectionMatch[0].match(/<h3[\s>]/gi) ?? []).length : 0;
  if (faqCount > 0 && faqH3Count === 0) addIssue('faq', 'warning', 'FAQ-блок не найден', 'Добавить H2 с FAQ');

  // --- Запрещённые слова ---
  for (const fw of forbiddenWords) {
    if (textLower.includes(fw)) addIssue('forbidden', 'critical', `Запрещённое слово "${fw}" найдено в тексте`, `Удалить "${fw}" из текста`);
  }

  // --- Ключ в начале H2 ---
  const h2Regex = /<h2[\s>][\s\S]*?<\/h2>/gi;
  let h2Match: RegExpExecArray | null;
  while ((h2Match = h2Regex.exec(html)) !== null) {
    const h2Text = h2Match[0].replace(/<[^>]*>/g, '').trim();
    const afterH2Start = h2Match.index + h2Match[0].length;
    const after200 = html.slice(afterH2Start, afterH2Start + 600)
      .replace(/<[^>]*>/g, '').slice(0, 200).toLowerCase();
    const hasMainKey = after200.includes(mainKeyword);
    const hasAnyKey = hasMainKey || keywordList.some(kw => after200.includes(kw));
    if (!hasAnyKey) {
      addIssue('keyword', 'info', `H2 "${h2Text}" — нет ключа в первых 200 символах после заголовка`);
    }
  }

  // --- own_sources ---
  const ownSources = ((input.own_sources as string) ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const url of ownSources) {
    if (!html.includes(url)) {
      addIssue('links', 'warning', `Источник "${url}" не использован в тексте`);
    }
  }

  // --- Длина FAQ-ответов ---
  if (faqSectionMatch) {
    const faqHtml = faqSectionMatch[0];
    const faqH3Regex = /<h3[\s>][\s\S]*?<\/h3>/gi;
    const faqH3Positions: { question: string; start: number }[] = [];
    let fH3: RegExpExecArray | null;
    while ((fH3 = faqH3Regex.exec(faqHtml)) !== null) {
      faqH3Positions.push({
        question: fH3[0].replace(/<[^>]*>/g, '').trim(),
        start: fH3.index + fH3[0].length,
      });
    }
    for (let i = 0; i < faqH3Positions.length; i++) {
      const end = i + 1 < faqH3Positions.length
        ? faqHtml.indexOf('<h3', faqH3Positions[i].start)
        : faqHtml.length;
      const answerText = faqHtml.slice(faqH3Positions[i].start, end > -1 ? end : faqHtml.length)
        .replace(/<[^>]*>/g, '').trim();
      const q = faqH3Positions[i].question;
      if (answerText.length > 500) {
        addIssue('faq', 'warning', `FAQ ответ "${q}" слишком длинный: ${answerText.length} символов (макс 500)`);
      } else if (answerText.length < 100) {
        addIssue('faq', 'info', `FAQ ответ "${q}" слишком короткий: ${answerText.length} символов (мин 100)`);
      }
    }
  }

  // --- CTA ---
  const ctaText = ((input.cta as string) ?? '').trim();
  if (ctaText.length > 0) {
    const ctaSnippet = ctaText.slice(0, 30).toLowerCase();
    if (!textLower.includes(ctaSnippet)) {
      addIssue('cta', 'warning', 'CTA не найден в тексте');
    }
  }

  // --- Одинаковые начала абзацев ---
  const paragraphs = (html.match(/<p[\s>][\s\S]*?<\/p>/gi) ?? [])
    .map(p => p.replace(/<[^>]*>/g, '').trim())
    .filter(p => p.length > 0);
  const pStarts = paragraphs.map(p => p.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  for (let i = 0; i <= pStarts.length - 3; i++) {
    if (pStarts[i] === pStarts[i + 1] && pStarts[i] === pStarts[i + 2]) {
      addIssue('quality', 'warning', `Одинаковое начало абзацев подряд: "${pStarts[i]}"`, 'Разнообразить начала абзацев');
      break;
    }
  }

  // --- Дубли абзацев ---
  for (let i = 0; i < paragraphs.length; i++) {
    const wordsA = paragraphs[i].toLowerCase().split(/\s+/).filter(Boolean);
    if (wordsA.length < 5) continue;
    for (let j = i + 1; j < paragraphs.length; j++) {
      const wordsB = paragraphs[j].toLowerCase().split(/\s+/).filter(Boolean);
      if (wordsB.length < 5) continue;
      const setB = new Set(wordsB);
      const common = wordsA.filter(w => setB.has(w)).length;
      const similarity = common / Math.max(wordsA.length, wordsB.length);
      if (similarity > 0.8) {
        addIssue('quality', 'warning', 'Дублирующиеся абзацы');
        break;
      }
    }
    if (issues.some(iss => iss.message === 'Дублирующиеся абзацы')) break;
  }

  // --- Качество текста ---
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Собираем слова из ключевых фраз для исключения из спама
  const keywordTokens = new Set<string>();
  for (const part of [mainKeyword, ...keywordList]) {
    for (const tok of part.split(/\s+/)) {
      const clean = tok.replace(/[^а-яёa-z]/g, '');
      if (clean.length > 0) keywordTokens.add(clean);
    }
  }

  // Заспамленность (исключая слова из ключевых фраз)
  const wordFreq: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3 && !keywordTokens.has(wl)) wordFreq[wl] = (wordFreq[wl] ?? 0) + 1;
  }
  const totalSignificant = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  const repeatedWords = Object.values(wordFreq).filter(c => c > 2).reduce((a, b) => a + b, 0);
  const spam = totalSignificant > 0 ? Math.round((repeatedWords / totalSignificant) * 100) : 0;

  // Водность: (вводные + канцеляризмы + усилители + связки + местоимения×0.5) / totalWords × 100
  let waterFull = 0;
  let waterHalf = 0;
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (!wl) continue;
    if (WATER_WORDS.introductory.has(wl) || WATER_WORDS.bureaucratic.has(wl)
      || WATER_WORDS.amplifiers.has(wl) || WATER_WORDS.parasiteWords.has(wl)) {
      waterFull++;
    } else if (WATER_WORDS.pronouns.has(wl)) {
      waterHalf++;
    }
  }
  for (const phrase of WATER_WORDS.parasitePhrases) {
    let si = 0;
    while ((si = textLower.indexOf(phrase, si)) !== -1) {
      waterFull++;
      si += phrase.length;
    }
  }
  const water = wordCount > 0
    ? Math.round((waterFull + waterHalf * 0.5) / wordCount * 100)
    : 0;

  // Полный wordFreq (включая ключевые) для тошноты
  const wordFreqFull: Record<string, number> = {};
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^а-яёa-z]/g, '');
    if (wl.length > 3) wordFreqFull[wl] = (wordFreqFull[wl] ?? 0) + 1;
  }
  const totalSignificantFull = Object.values(wordFreqFull).reduce((a, b) => a + b, 0);

  // Тошнота классическая
  const maxFreq = Math.max(...Object.values(wordFreqFull), 0);
  const nauseaClassic = Math.round(Math.sqrt(maxFreq) * 10) / 10;

  // Тошнота академическая
  const nauseaAcademic = totalSignificantFull > 0
    ? Math.round((maxFreq / totalSignificantFull) * 1000) / 10
    : 0;

  // Тошнота по H2-блокам
  const h2BlockRegex = /<h2[\s>][\s\S]*?(?=<h2[\s>]|$)/gi;
  const h2Blocks = html.match(h2BlockRegex) ?? [];
  for (const block of h2Blocks) {
    const h2Title = (block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ?? ['', ''])[1].replace(/<[^>]*>/g, '').trim();
    const blockText = block.replace(/<[^>]*>/g, '');
    const blockWords = blockText.split(/\s+/).filter(Boolean);
    const bFreq: Record<string, number> = {};
    for (const bw of blockWords) {
      const bwl = bw.toLowerCase().replace(/[^а-яёa-z]/g, '');
      if (bwl.length > 3) bFreq[bwl] = (bFreq[bwl] ?? 0) + 1;
    }
    const bMaxFreq = Math.max(...Object.values(bFreq), 0);
    const blockNausea = Math.round(Math.sqrt(bMaxFreq) * 10) / 10;
    if (blockNausea > 10) {
      addIssue('quality', 'warning', `Высокая тошнота в блоке "${h2Title}": ${blockNausea}`);
    }
  }

  // Расстояние между ключами
  const keyPositions: number[] = [];
  const keyRegexDist = new RegExp(mainKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let keyMatch: RegExpExecArray | null;
  while ((keyMatch = keyRegexDist.exec(text)) !== null) {
    keyPositions.push(keyMatch.index);
  }
  for (let ki = 1; ki < keyPositions.length; ki++) {
    if (keyPositions[ki] - keyPositions[ki - 1] < 300) {
      addIssue('keyword', 'warning', 'Основной ключ встречается дважды в радиусе 300 символов');
      break;
    }
  }
  if (keyPositions.length > 0) {
    if (keyPositions[0] > 3000) {
      addIssue('keyword', 'info', 'Участок >3000 символов без основного ключа');
    }
    for (let ki = 1; ki < keyPositions.length; ki++) {
      if (keyPositions[ki] - keyPositions[ki - 1] > 3000) {
        addIssue('keyword', 'info', 'Участок >3000 символов без основного ключа');
        break;
      }
    }
    if (text.length - keyPositions[keyPositions.length - 1] > 3000) {
      addIssue('keyword', 'info', 'Участок >3000 символов без основного ключа');
    }
  }

  // Читабельность
  const countSyllables = (word: string): number => {
    const vowels = word.toLowerCase().match(/[аеёиоуыэюяaeiouy]/g);
    return vowels ? vowels.length : 1;
  };
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avgSentLen = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
  const longSentRatio = sentenceLengths.length > 0
    ? sentenceLengths.filter(l => l > 25).length / sentenceLengths.length : 0;
  const complexWordRatio = wordCount > 0
    ? words.filter(w => countSyllables(w.replace(/[^а-яёa-zа-яА-ЯЁё]/gi, '')) > 4).length / wordCount : 0;

  const stopConstructions = [
    'в настоящее время', 'стоит отметить', 'как известно',
    'на сегодняшний день', 'важно отметить', 'следует подчеркнуть',
    'необходимо учитывать', 'таким образом', 'давайте разберёмся',
  ];
  const stopConstructionHits = stopConstructions.filter(sc => textLower.includes(sc)).length;

  let readability = 10
    - (avgSentLen > 18 ? (avgSentLen - 18) * 0.15 : 0)
    - (longSentRatio * 3)
    - (complexWordRatio * 2)
    - (stopConstructionHits * 0.5)
    - (water > 20 ? 1 : 0);
  readability = Math.max(1, Math.min(10, Math.round(readability * 10) / 10));

  // Разнообразие структуры предложений
  const sentFirstWords = sentences.map(s => {
    const fw = s.trim().split(/\s+/)[0];
    return fw ? fw.toLowerCase().replace(/[^а-яёa-z]/g, '') : '';
  }).filter(Boolean);
  for (let si = 0; si <= sentFirstWords.length - 4; si++) {
    if (sentFirstWords[si] === sentFirstWords[si + 1]
      && sentFirstWords[si] === sentFirstWords[si + 2]
      && sentFirstWords[si] === sentFirstWords[si + 3]) {
      addIssue('quality', 'warning', 'Однообразные начала предложений');
      break;
    }
  }
  if (sentFirstWords.length > 0) {
    const fwFreq: Record<string, number> = {};
    for (const fw of sentFirstWords) fwFreq[fw] = (fwFreq[fw] ?? 0) + 1;
    const maxFwRatio = Math.max(...Object.values(fwFreq)) / sentFirstWords.length;
    if (maxFwRatio > 0.3) {
      const topWord = Object.entries(fwFreq).sort((a, b) => b[1] - a[1])[0][0];
      addIssue('quality', 'warning',
        `>${Math.round(maxFwRatio * 100)}% предложений начинаются со слова "${topWord}"`,
        'Разнообразить начала предложений');
    }
  }

  // Стена текста: каждые 3000 символов должен быть визуальный разделитель
  const visualBreakRegex = /<(?:ul|ol|blockquote|h2|h3|figure)[\s>]/gi;
  const breakPositions: number[] = [];
  let vbMatch: RegExpExecArray | null;
  while ((vbMatch = visualBreakRegex.exec(html)) !== null) {
    breakPositions.push(vbMatch.index);
  }
  let chunkStart = 0;
  const wallThreshold = 3000;
  for (let pos = wallThreshold; pos < html.length; pos += wallThreshold) {
    const hasBreak = breakPositions.some(bp => bp > chunkStart && bp <= pos);
    if (!hasBreak) {
      const chunkText = html.slice(chunkStart, pos).replace(/<[^>]*>/g, '').trim();
      if (chunkText.length > wallThreshold * 0.5) {
        addIssue('quality', 'info', 'Стена текста: >3000 символов без визуального разделителя');
        break;
      }
    }
    chunkStart = pos;
  }

  // Лексическое разнообразие (поле uniqueness для обратной совместимости)
  const uniqueWords = Object.keys(wordFreqFull).length;
  const uniqueness = wordCount > 0 ? Math.min(98, Math.round((uniqueWords / wordCount) * 200)) : 85;

  if (spam > 60) addIssue('quality', 'warning', `Заспамленность ${spam}% (макс 60%)`, 'Разнообразить лексику');
  if (water > 25) addIssue('quality', 'warning', `Водность ${water}% (макс 25%)`, 'Убрать вводные слова');
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
    faq_count: faqH3Count,
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
