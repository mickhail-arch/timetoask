import { serperSearch } from '@/adapters/search';
import { fetchAndParseMany } from '@/adapters/scraping';
import { generateImage } from '@/adapters/llm';
import { marked } from 'marked';
import { pipelineLlm } from '../pipeline.runner';
import type { PipelineStepDef, PipelineContext } from '../pipeline.types';

const PARSE_TOP_N = 5;
const MAX_REVISION_ITERATIONS = 3;
const SEO_PASS_THRESHOLD = 80;

type SeoAudit = { score: number; issues: string[] };
type CompetitorEntry = {
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  links: string[];
};

// ── helpers ──────────────────────────────────────────────────────────────────

function extractFirstH1(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function countKeywordOccurrences(text: string, keyword: string): number {
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text.match(re) ?? []).length;
}

function runSeoAudit(articleText: string, keyword: string): SeoAudit {
  const issues: string[] = [];
  let score = 100;

  const words = articleText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Keyword density
  const kwCount = countKeywordOccurrences(articleText, keyword);
  const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
  if (density < 0.5) {
    issues.push(`Keyword density too low: ${density.toFixed(2)}% (min 0.5%)`);
    score -= 15;
  } else if (density > 3) {
    issues.push(`Keyword density too high: ${density.toFixed(2)}% (max 3%)`);
    score -= 10;
  }

  // H1 presence
  const h1Match = articleText.match(/^#\s+.+$/m);
  if (!h1Match) {
    issues.push('Missing H1 heading');
    score -= 20;
  } else if (!h1Match[0].toLowerCase().includes(keyword.toLowerCase())) {
    issues.push('H1 does not contain the target keyword');
    score -= 10;
  }

  // H2 presence
  const h2Matches = articleText.match(/^##\s+.+$/gm) ?? [];
  if (h2Matches.length === 0) {
    issues.push('No H2 headings found');
    score -= 15;
  }

  // Heading hierarchy: check for skipped levels (H1 -> H3 without H2)
  const headingLevels = (articleText.match(/^(#{1,6})\s/gm) ?? []).map(
    (h) => h.trim().length,
  );
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push(
        `Skipped heading level: H${headingLevels[i - 1]} -> H${headingLevels[i]}`,
      );
      score -= 5;
      break;
    }
  }

  // Title length (first H1 text)
  const title = extractFirstH1(articleText);
  if (title.length > 0 && title.length < 30) {
    issues.push(`Title too short: ${title.length} chars (recommended 30-60)`);
    score -= 5;
  } else if (title.length > 70) {
    issues.push(`Title too long: ${title.length} chars (recommended 30-60)`);
    score -= 5;
  }

  // Word count check
  if (wordCount < 300) {
    issues.push(`Article too short: ${wordCount} words`);
    score -= 20;
  }

  return { score: Math.max(0, score), issues };
}

// ── Step 0 — search ─────────────────────────────────────────────────────────

const searchStep: PipelineStepDef = {
  name: 'search',
  async execute(ctx) {
    const { keyword, language } = ctx.input as {
      keyword: string;
      language: string;
    };
    const hl = language === 'ru' ? 'ru' : 'en';
    const gl = language === 'ru' ? 'ru' : 'us';

    const { organic } = await serperSearch(keyword, { hl, gl, num: 10 });
    ctx.data.searchResults = organic;
    return { searchResults: organic };
  },
};

// ── Step 1 — parse ──────────────────────────────────────────────────────────

const parseStep: PipelineStepDef = {
  name: 'parse',
  async execute(ctx) {
    const searchResults = ctx.data.searchResults as Array<{
      link: string;
    }>;
    const urls = searchResults.slice(0, PARSE_TOP_N).map((r) => r.link);
    const pages = await fetchAndParseMany(urls);

    const competitorData: CompetitorEntry[] = pages.map((p) => ({
      url: p.url,
      title: p.title,
      headings: p.headings,
      wordCount: p.text.split(/\s+/).filter(Boolean).length,
      links: [],
    }));

    ctx.data.competitorData = competitorData;
    return { competitorData };
  },
};

// ── Step 2 — brief ──────────────────────────────────────────────────────────

const briefStep: PipelineStepDef = {
  name: 'brief',
  modelOverride: 'google/gemini-2.5-flash',
  async execute(ctx) {
    const { keyword, language, wordCount } = ctx.input as {
      keyword: string;
      language: string;
      wordCount: number;
    };
    const competitorData = ctx.data.competitorData as CompetitorEntry[];
    const searchResults = ctx.data.searchResults as Array<{
      title: string;
      snippet: string;
      position: number;
    }>;

    const serp = searchResults
      .map((r) => `${r.position}. ${r.title} — ${r.snippet}`)
      .join('\n');

    const competitors = competitorData
      .map(
        (c) =>
          `### ${c.title}\nURL: ${c.url}\nHeadings: ${c.headings.join(' | ')}\nWord count: ${c.wordCount}`,
      )
      .join('\n\n');

    const prompt = `Create a detailed content brief (ТЗ) for an SEO article.

Target keyword: ${keyword}
Language: ${language}
Target word count: ${wordCount}

SERP results:
${serp}

Competitor analysis:
${competitors}

Produce a structured brief:
1. Suggested title (H1) containing the keyword
2. Meta description (120-160 chars)
3. Full heading structure (H2, H3)
4. Key points for each section
5. LSI / related keywords to weave in
6. Unique angle to differentiate from competitors

Output as structured text.`;

    const brief = await pipelineLlm(briefStep, ctx, prompt);
    ctx.data.brief = brief;
    return { brief };
  },
};

// ── Step 3 — write ──────────────────────────────────────────────────────────

const writeStep: PipelineStepDef = {
  name: 'write',
  modelOverride: 'anthropic/claude-sonnet-4-5',
  async execute(ctx) {
    const { keyword, language, wordCount } = ctx.input as {
      keyword: string;
      language: string;
      wordCount: number;
    };
    const brief = ctx.data.brief as string;

    const prompt = `Write a full SEO article based on the following brief.

Target keyword: ${keyword}
Language: ${language}
Target word count: ${wordCount}

Brief / ТЗ:
${brief}

Rules:
- Follow the heading structure from the brief exactly.
- Write naturally; avoid keyword stuffing.
- Use short paragraphs, bullet lists, and examples.
- Include an engaging introduction and a clear conclusion with a CTA.
- Output as clean Markdown (# H1, ## H2, ### H3, paragraphs, lists). No HTML.`;

    const articleText = await pipelineLlm(writeStep, ctx, prompt);
    const articleTitle = extractFirstH1(articleText);

    ctx.data.articleText = articleText;
    ctx.data.articleTitle = articleTitle;
    return { articleText, articleTitle };
  },
};

// ── Step 4 — image-prompt ───────────────────────────────────────────────────

const imagePromptStep: PipelineStepDef = {
  name: 'image-prompt',
  modelOverride: 'google/gemini-2.5-flash',
  async execute(ctx) {
    const articleTitle = ctx.data.articleTitle as string;
    const articleText = ctx.data.articleText as string;
    const excerpt = articleText.slice(0, 200);

    const prompt = `Generate ONE image generation prompt in English describing a relevant hero image for the following article.

Article title: "${articleTitle}"
Article excerpt: "${excerpt}"

Requirements:
- Describe a photorealistic or illustrative scene relevant to the article topic.
- Be specific about composition, lighting, and mood.
- Keep it under 200 words.
- Output ONLY the image prompt text, nothing else.`;

    const imagePrompt = await pipelineLlm(imagePromptStep, ctx, prompt);
    ctx.data.imagePrompt = imagePrompt.trim();
    return { imagePrompt: ctx.data.imagePrompt };
  },
};

// ── Step 5 — images ─────────────────────────────────────────────────────────

const imagesStep: PipelineStepDef = {
  name: 'images',
  modelOverride: 'bytedance/seedream-4.5',
  async execute(ctx) {
    const imagePrompt = ctx.data.imagePrompt as string;

    const result = await generateImage({
      model: 'bytedance/seedream-4.5',
      prompt: imagePrompt,
    });

    const heroImage = result.url ?? result.b64_json ?? '';
    ctx.data.heroImage = heroImage;
    return { heroImage };
  },
};

// ── Step 6 — seo-audit (programmatic) ───────────────────────────────────────

const seoAuditStep: PipelineStepDef = {
  name: 'seo-audit',
  async execute(ctx) {
    const articleText = ctx.data.articleText as string;
    const { keyword } = ctx.input as { keyword: string };

    const seoAudit = runSeoAudit(articleText, keyword);
    ctx.data.seoAudit = seoAudit;
    return seoAudit;
  },
};

// ── Step 7 — revise (up to 3 iterations, only if score < 80) ───────────────

const reviseStep: PipelineStepDef = {
  name: 'revise',
  modelOverride: 'anthropic/claude-sonnet-4-5',
  async execute(ctx) {
    const { keyword, language } = ctx.input as {
      keyword: string;
      language: string;
    };
    let articleText = ctx.data.articleText as string;
    let seoAudit = ctx.data.seoAudit as SeoAudit;

    for (let i = 0; i < MAX_REVISION_ITERATIONS; i++) {
      if (seoAudit.score >= SEO_PASS_THRESHOLD) break;

      const issuesList = seoAudit.issues.map((s, j) => `${j + 1}. ${s}`).join('\n');

      const prompt = `Revise the article below to fix the SEO issues listed.

Target keyword: "${keyword}"
Language: ${language}
Revision iteration: ${i + 1}/${MAX_REVISION_ITERATIONS}
Current SEO score: ${seoAudit.score}/100

Article (Markdown):
${articleText}

Issues to fix:
${issuesList}

Rules:
- Fix every listed issue.
- Keep the same Markdown heading structure.
- Do not reduce content quality or length.
- Output the full revised article in Markdown.`;

      articleText = await pipelineLlm(reviseStep, ctx, prompt);
      seoAudit = runSeoAudit(articleText, keyword);
    }

    ctx.data.articleText = articleText;
    ctx.data.articleTitle = extractFirstH1(articleText);
    ctx.data.seoAudit = seoAudit;
    return { articleText, seoAudit };
  },
};

// ── Step 8 — fact-check ─────────────────────────────────────────────────────

const factCheckStep: PipelineStepDef = {
  name: 'fact-check',
  modelOverride: 'google/gemini-2.5-flash',
  async execute(ctx) {
    const articleText = ctx.data.articleText as string;

    const prompt = `Fact-check the following article. Identify every factual claim and verify it.

Article:
${articleText}

For each claim output a JSON array entry:
{ "claim": "...", "verdict": "CONFIRMED|UNVERIFIED|INCORRECT", "note": "..." }

At the end, output a JSON summary:
{ "verified": true/false, "corrections": ["...", "..."] }

where "verified" is true only if zero INCORRECT verdicts were found,
and "corrections" lists recommended fixes for any INCORRECT or UNVERIFIED claims.

Output ONLY valid JSON: { "verified": boolean, "corrections": string[] }`;

    const raw = await pipelineLlm(factCheckStep, ctx, prompt);

    let factCheck: { verified: boolean; corrections: string[] };
    try {
      factCheck = JSON.parse(raw);
    } catch {
      factCheck = { verified: true, corrections: [] };
    }

    ctx.data.factCheck = factCheck;
    return factCheck;
  },
};

// ── Step 9 — assemble (no LLM) ─────────────────────────────────────────────

const assembleStep: PipelineStepDef = {
  name: 'assemble',
  async execute(ctx) {
    const articleText = ctx.data.articleText as string;
    const articleTitle = ctx.data.articleTitle as string;
    const heroImage = (ctx.data.heroImage as string) ?? '';
    const { keyword, language } = ctx.input as {
      keyword: string;
      language: string;
    };

    const bodyHtml = await marked.parse(articleText);

    const heroTag = heroImage
      ? `<img src="${heroImage}" alt="${articleTitle}" loading="lazy" />\n`
      : '';

    const description =
      articleText
        .replace(/^#.+$/gm, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 155) + '…';

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: articleTitle,
      description,
      inLanguage: language === 'ru' ? 'ru-RU' : 'en-US',
      keywords: keyword,
      ...(heroImage && !heroImage.startsWith('data:')
        ? { image: heroImage }
        : {}),
    });

    const finalHtml = `<article>
${heroTag}${bodyHtml}
<script type="application/ld+json">${jsonLd}</script>
</article>`;

    const metadata = { title: articleTitle, description, keyword };

    ctx.data.finalHtml = finalHtml;
    ctx.data.metadata = metadata;

    return {
      html: finalHtml,
      metadata,
      seoAudit: ctx.data.seoAudit,
      factCheck: ctx.data.factCheck,
    };
  },
};

// ── Export ───────────────────────────────────────────────────────────────────

export const seoArticleSteps: PipelineStepDef[] = [
  searchStep,   // 0
  parseStep,    // 1
  briefStep,    // 2
  writeStep,    // 3
  imagePromptStep, // 4
  imagesStep,   // 5
  seoAuditStep, // 6
  reviseStep,   // 7
  factCheckStep, // 8
  assembleStep, // 9
];
