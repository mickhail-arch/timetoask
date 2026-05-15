// adapters/research/perplexity.adapter.ts — поиск авторитетных источников через Perplexity Sonar Pro Search
import { env } from '@/core/config/env';
import { redis } from '@/lib/redis';
import { createHash } from 'crypto';

export type AuthorityCategory = 'laws' | 'government' | 'research' | 'statistics' | 'media' | 'wikipedia';

export type AuthoritySource = {
  url: string;
  anchor: string;
  category: AuthorityCategory;
  fact: string;
};

export type AuthoritySearchParams = {
  query: string;
  topic?: string;
  categories: AuthorityCategory[];
  intent?: string;
  geo?: string;
  count?: number;
};

const CATEGORY_DESCRIPTIONS: Record<AuthorityCategory, string> = {
  laws: 'official Russian Federation laws and regulations (consultant.ru, garant.ru, pravo.gov.ru, kremlin.ru)',
  government: 'official Russian government bodies and ministries (.gov.ru, .gosuslugi.ru, federal services and ministries)',
  research: 'scientific journals, academic papers, peer-reviewed studies (elibrary.ru, mathnet.ru, pubmed, doi.org, scholar)',
  statistics: 'official statistics agencies and economic data (rosstat.gov.ru, cbr.ru, minfin.gov.ru)',
  media: 'authoritative Russian news media (rbc.ru, vedomosti.ru, kommersant.ru, tass.ru, ria.ru, forbes.ru)',
  wikipedia: 'Wikipedia articles for general educational topics (ru.wikipedia.org)',
};

function buildCacheKey(params: AuthoritySearchParams): string {
  const normalized = JSON.stringify({
    q: params.query.toLowerCase().trim(),
    cats: [...params.categories].sort(),
    intent: params.intent ?? 'informational',
    geo: params.geo ?? '',
  });
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `authority:${hash}`;
}

export async function searchAuthoritySources(params: AuthoritySearchParams): Promise<AuthoritySource[]> {
  if (!env.PERPLEXITY_AUTHORITY_ENABLED) return [];
  if (params.categories.length === 0) return [];

  const cacheKey = buildCacheKey(params);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.info(`[perplexity] cache hit for "${params.query}"`);
      return JSON.parse(cached) as AuthoritySource[];
    }
  } catch (err) {
    console.warn('[perplexity] cache read failed:', err);
  }

  const categoriesText = params.categories.map(c => `- ${c}: ${CATEGORY_DESCRIPTIONS[c]}`).join('\n');
  const count = Math.min(params.count ?? 5, 8);

  const systemPrompt = `You are a research assistant. Find ${count} authoritative sources in RUSSIAN that support facts about the topic.

ALLOWED CATEGORIES:
${categoriesText}

REQUIREMENTS:
- All sources must be in Russian language or about Russia.
- Each URL must be a REAL, working link from one of the allowed domain types.
- Provide a Russian anchor text (3-7 words) that fits naturally in a sentence.
- Provide a Russian "fact" (1-2 sentences) — a verifiable fact from this source that can be cited in an article.
- Avoid duplicate domains: max 2 sources from the same domain.
- Skip categories that don't fit the topic (e.g. no "laws" if the topic is about design).

Return ONLY valid JSON array, no markdown:
[
  {"url": "https://...", "anchor": "русский анкор", "category": "laws|government|research|statistics|media|wikipedia", "fact": "Конкретный факт из источника на русском"}
]`;

  const userMessage = `Topic: ${params.query}
${params.topic ? `Context: ${params.topic}` : ''}
Intent: ${params.intent ?? 'informational'}
${params.geo ? `Geographic focus: ${params.geo}` : ''}

Find ${count} authoritative sources with verifiable facts.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro-search',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[perplexity] HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return [];
    }

    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = body?.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[perplexity] empty content');
      return [];
    }

    const cleaned = content.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) {
        console.warn('[perplexity] no JSON array found in response');
        return [];
      }
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed)) {
      console.warn('[perplexity] response is not an array');
      return [];
    }

    const sources: AuthoritySource[] = (parsed as Record<string, unknown>[])
      .filter(s => typeof s.url === 'string' && typeof s.anchor === 'string' && typeof s.fact === 'string')
      .map(s => ({
        url: String(s.url),
        anchor: String(s.anchor).trim(),
        category: (params.categories.includes(s.category as AuthorityCategory)
          ? s.category
          : params.categories[0]) as AuthorityCategory,
        fact: String(s.fact).trim(),
      }))
      .filter(s => {
        try { new URL(s.url); return true; } catch { return false; }
      })
      .slice(0, count);

    try {
      await redis.setex(cacheKey, env.PERPLEXITY_AUTHORITY_CACHE_TTL, JSON.stringify(sources));
    } catch (err) {
      console.warn('[perplexity] cache write failed:', err);
    }

    console.info(`[perplexity] found ${sources.length} sources for "${params.query}"`);
    return sources;
  } catch (err) {
    console.warn('[perplexity] request failed:', err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
