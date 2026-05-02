import * as cheerio from 'cheerio';

export type ParsedPage = {
  url: string;
  title: string;
  headings: string[];
  text: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  slug: string;
};

const MAX_TEXT_LENGTH = 8_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function fetchAndParse(url: string): Promise<ParsedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MarketingAI/1.0; +https://timetoask.app)',
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed ${res.status}: ${url}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const metaTitle = $('title').first().text().trim() || '';
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || '';

    let slug = '';
    try {
      const urlPath = new URL(url).pathname;
      const segments = urlPath.split('/').filter(Boolean);
      slug = segments[segments.length - 1] || '';
    } catch {}

    $('script, style, nav, footer, header, aside, iframe, noscript').remove();

    const title = metaTitle;

    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      const t = $(el).text().trim();
      if (t) headings.push(t);
    });

    let text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '…';
    }

    return { url, title, headings, text, metaTitle, metaDescription, ogTitle, ogDescription, canonicalUrl, slug };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAndParseMany(
  urls: string[],
  concurrency = 3,
): Promise<ParsedPage[]> {
  const results: ParsedPage[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fetchAndParse));

    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }

  return results;
}
