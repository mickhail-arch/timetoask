// modules/seo/steps/step-0-research.ts — анализ выдачи и парсинг мета-тегов конкурентов
import { serperSearch } from '@/adapters/search/serper.adapter';
import { fetchAndParseMany } from '@/adapters/scraping/cheerio.adapter';
import type { StepResult, PipelineContext, CompetitorMeta } from '../types';

export async function executeResearch(ctx: PipelineContext): Promise<StepResult> {
  const start = Date.now();

  const query = (ctx.input.target_query as string) ?? '';
  const keywords = (ctx.input.keywords as string) ?? '';
  const searchQuery = query || keywords.split('\n')[0] || '';

  if (!searchQuery.trim()) {
    console.warn('[step-0-research] No search query, skipping competitor analysis');
    ctx.data.competitorMeta = [];
    return { success: true, data: { competitorMeta: [] }, durationMs: Date.now() - start };
  }

  // 1. Поиск через Serper.dev
  let urls: string[] = [];
  try {
    const serperResult = await serperSearch(searchQuery, { num: 10, gl: 'ru', hl: 'ru' });
    urls = (serperResult.organic ?? [])
      .map((r) => r.link)
      .filter((url): url is string => !!url)
      .slice(0, 10);
    console.info(`[step-0-research] Serper found ${urls.length} URLs for "${searchQuery}"`);
  } catch (err) {
    console.error('[step-0-research] Serper failed:', err instanceof Error ? err.message : err);
    ctx.data.competitorMeta = [];
    return { success: true, data: { competitorMeta: [] }, durationMs: Date.now() - start };
  }

  if (urls.length === 0) {
    ctx.data.competitorMeta = [];
    return { success: true, data: { competitorMeta: [] }, durationMs: Date.now() - start };
  }

  // Домены-исключения: маркетплейсы, соцсети, агрегаторы, сервисы
  const EXCLUDED_DOMAINS = [
    'avito.ru',
    'ozon.ru',
    'wildberries.ru',
    'market.yandex.ru',
    'aliexpress.ru',
    'aliexpress.com',
    'amazon.com',
    'ebay.com',
    'reddit.com',
    'vk.com',
    'ok.ru',
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'tiktok.com',
    't.me',
    'telegram.org',
    'youtube.com',
    'youtu.be',
    'pinterest.com',
    'wikipedia.org',
    'translate.google.com',
    'translate.yandex.ru',
    'maps.google.com',
    'yandex.ru/maps',
    '2gis.ru',
    'hh.ru',
    'superjob.ru',
    'kinopoisk.ru',
    'imdb.com',
    'music.yandex.ru',
    'spotify.com',
    'apple.com',
    'play.google.com',
    'apps.apple.com',
  ];

  // Паттерны title, указывающие на бесполезный контент
  const EXCLUDED_TITLE_PATTERNS = [
    /please wait/i,
    /verification/i,
    /captcha/i,
    /access denied/i,
    /403 forbidden/i,
    /404 not found/i,
    /page not found/i,
    /just a moment/i,
    /cloudflare/i,
    /купить.*доставк/i,
    /цена.*купить/i,
    /объявлени[йея]/i,
    /в корзину/i,
  ];

  const filteredUrls = urls.filter(url => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (EXCLUDED_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
        console.info(`[step-0-research] Filtered out (domain): ${url}`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  console.info(`[step-0-research] After domain filter: ${filteredUrls.length} of ${urls.length} URLs`);

  // 2. Параллельный парсинг первых 5 URL (concurrency=3 внутри fetchAndParseMany)
  const parsed = await fetchAndParseMany(filteredUrls.slice(0, 5), 3);

  const competitorMeta: CompetitorMeta[] = parsed.map((page) => ({
    url: page.url,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    canonicalUrl: page.canonicalUrl,
    slug: page.slug,
  }));

  console.info(
    `[step-0-research] Collected ${competitorMeta.length} competitor meta from ${urls.length} URLs`,
  );

  // Фильтрация после парсинга — убрать страницы с мусорным title
  const cleanMeta = competitorMeta.filter(c => {
    if (!c.metaTitle || c.metaTitle.length < 10) {
      console.info(`[step-0-research] Filtered out (empty title): ${c.url}`);
      return false;
    }
    if (EXCLUDED_TITLE_PATTERNS.some(p => p.test(c.metaTitle!))) {
      console.info(`[step-0-research] Filtered out (bad title): ${c.url} — "${c.metaTitle}"`);
      return false;
    }
    if (!c.metaDescription && !c.ogDescription) {
      console.info(`[step-0-research] Filtered out (no description): ${c.url}`);
      return false;
    }
    return true;
  });

  console.info(`[step-0-research] After content filter: ${cleanMeta.length} of ${competitorMeta.length} pages`);

  ctx.data.competitorMeta = cleanMeta;

  return {
    success: true,
    data: { competitorMeta: cleanMeta },
    durationMs: Date.now() - start,
  };
}
