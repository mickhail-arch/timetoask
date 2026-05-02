// modules/seo/steps/step-6-images.ts — генерация изображений по финальному тексту
import type { StepResult, PipelineContext } from '../types';
import { getStepModel } from '../config';
import { generateText, generateImage } from '@/adapters/llm/openrouter.adapter';
import type { ToolConfig } from '@/core/types';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function saveImageToDisk(jobId: string, markerNum: string, base64: string): Promise<string> {
  const dir = join(process.cwd(), 'public', 'uploads', 'images');
  await mkdir(dir, { recursive: true });
  const fileName = `${jobId}-${markerNum}.png`;
  const filePath = join(dir, fileName);
  const buffer = Buffer.from(base64, 'base64');
  await writeFile(filePath, buffer);
  return `/uploads/images/${fileName}`;
}

function extractMarkerContext(html: string, markerNum: string): string {
  const markerTag = `[IMAGE_${markerNum}]`;
  const markerPos = html.indexOf(markerTag);
  if (markerPos < 0) return '';

  const before = html.slice(Math.max(0, markerPos - 2000), markerPos)
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(-600);

  const after = html.slice(markerPos + markerTag.length, markerPos + markerTag.length + 2000)
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);

  const beforeMarker = html.slice(0, markerPos);
  const lastH2 = beforeMarker.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  const h2Text = lastH2 ? lastH2[lastH2.length - 1].replace(/<[^>]*>/g, '').trim() : '';

  return `Section heading: ${h2Text}\nContext before image: ${before}\nContext after image: ${after}`;
}

/**
 * Шаг 6: генерация изображений.
 * Картинки генерируются ПОСЛЕ всех правок, по финальному тексту.
 * Если image_count=0 → пропуск.
 */
export async function executeImages(
  ctx: PipelineContext,
): Promise<StepResult> {
  const start = Date.now();

  const imageCount = (ctx.input.image_count as number) ?? 0;
  if (imageCount === 0) {
    return {
      success: true,
      data: { skipped: true, reason: 'image_count is 0' },
      durationMs: Date.now() - start,
    };
  }

  const config = ctx.config as ToolConfig | null;
  const promptModel = getStepModel(config, 'image_prompt', 'google/gemini-2.5-flash');
  const genModel = getStepModel(config, 'image_gen', 'google/gemini-3.1-flash-image-preview');

  // Получить статью из предыдущего шага (после правок)
  const revisionsData = ctx.data.ai_detect_revisions as Record<string, unknown>
    ?? ctx.data.step_5 as Record<string, unknown>
    ?? {};
  let articleHtml = (revisionsData.article_html as string) ?? '';

  // Получить комментарий к стилю изображений
  const imageComment = (ctx.input.image_comment as string) ?? '';
  const commentSuffix = imageComment ? `\n\nДополнительные пожелания к стилю изображений: ${imageComment}` : '';

  const imageTextOverlay = (ctx.input.image_text_overlay as boolean) ?? false;
  const imageAspect = (ctx.input.image_aspect as string) ?? '16:9';
  const imagePalette = (ctx.input.image_palette as string) ?? 'warm';
  const imagePaletteHex = (ctx.input.image_palette_hex as string) ?? '';
  const imageMood = (ctx.input.image_mood as string) ?? 'professional';
  const imageExclude = (ctx.input.image_exclude as string) ?? '';

  // Получить стили изображений
  const rawStyle = ctx.input.image_style;
  const imageStyles: string[] = Array.isArray(rawStyle)
    ? rawStyle
    : typeof rawStyle === 'string' && rawStyle.length > 0
      ? [rawStyle]
      : ['realistic'];
  const styleMap: Record<string, string> = {
    'realistic': 'photorealistic, professional photography, high detail',
    'abstract': 'abstract art, creative shapes, vibrant colors',
    '3d': '3D render, volumetric lighting, CGI, studio quality',
    'minimalism': 'minimalist, clean composition, flat design, white space',
    'illustrations': 'digital illustration, editorial style, hand-drawn feel',
  };
  const styleEN = imageStyles
    .map(s => styleMap[s.toLowerCase()] ?? s)
    .join(', ');

  const paletteMap: Record<string, string> = {
    warm: 'warm color palette: amber, golden, terracotta, soft orange tones',
    cold: 'cool color palette: blue, teal, silver, icy tones',
    pastel: 'pastel color palette: soft pink, light blue, lavender, mint',
    vibrant: 'vibrant high-contrast palette: saturated colors, bold contrasts',
    monochrome: 'monochrome palette: black, white, and shades of gray only',
    custom: imagePaletteHex ? `specific brand colors: ${imagePaletteHex}` : 'neutral balanced palette',
  };
  const paletteEN = paletteMap[imagePalette] ?? paletteMap.warm;

  const moodMap: Record<string, string> = {
    professional: 'professional and clean atmosphere, corporate feel, sharp focus',
    cozy: 'warm and cozy atmosphere, soft lighting, comfort, homely feel',
    tech: 'futuristic technology atmosphere, neon accents, digital elements, sci-fi feel',
    nature: 'natural organic atmosphere, green tones, sunlight, outdoors',
    medical: 'clean medical atmosphere, soft calming colors, clinical precision, trustworthy',
  };
  const moodEN = moodMap[imageMood] ?? moodMap.professional;

  const excludeEN = imageExclude
    ? `MUST NOT include: ${imageExclude}. `
    : 'No people faces (silhouettes, back views, or hands only). ';

  const sizeMap: Record<string, string> = {
    '16:9': '1792x1024',
    '1:1': '1024x1024',
    '9:16': '1024x1792',
  };
  const imageSize = sizeMap[imageAspect] ?? '1792x1024';

  // Найти маркеры [IMAGE_N] и описания [IMAGE_N_DESC: ...]
  const markerRegex = /\[IMAGE_(\d+)\]/g;
  const descRegex = /\[IMAGE_(\d+)_DESC:\s*([^\]]+)\]/g;

  const descriptions: Record<string, string> = {};
  let descMatch;
  while ((descMatch = descRegex.exec(articleHtml)) !== null) {
    descriptions[descMatch[1]] = descMatch[2].trim();
  }

  // Основной ключ (нужен и для fallback-описаний, поэтому объявлен до поиска маркеров)
  const targetQuery = (ctx.input.target_query as string) ?? '';
  const keywords = ((ctx.input.keywords as string) ?? '').split('\n').filter(Boolean);

  const markers: string[] = [];
  let markerMatch;
  while ((markerMatch = markerRegex.exec(articleHtml)) !== null) {
    if (!markers.includes(markerMatch[1])) {
      markers.push(markerMatch[1]);
    }
  }

  // Fallback: маркеры не найдены, но imageCount > 0
  let fallbackMode = false;
  if (markers.length === 0 && imageCount > 0) {
    console.warn(
      `[step-6] No [IMAGE_N] markers found in article HTML. Using fallback placement for ${imageCount} image(s).`,
    );
    fallbackMode = true;

    for (let i = 1; i <= imageCount; i++) {
      markers.push(String(i));
    }

    const descPromises = markers.map(async (num) => {
      try {
        const h2Matches = [...articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
        const h2Index = Math.min(parseInt(num) - 1, h2Matches.length - 1);
        const nearestH2 = h2Index >= 0 && h2Matches[h2Index]
          ? h2Matches[h2Index][1].replace(/<[^>]*>/g, '').trim()
          : '';

        const desc = await generateText({
          model: promptModel,
          systemPrompt:
            'Describe a suitable visual scene for an article illustration in 1-2 sentences in English. The scene must match the article section topic. Output ONLY the scene description, nothing else.',
          userMessage: `Article topic: ${targetQuery}\nSection: ${nearestH2 || targetQuery}\nImage ${num} of ${imageCount}. Style: ${styleEN}. Describe a unique, relevant scene that visually represents the section topic.${commentSuffix}`,
        });
        descriptions[num] = desc.trim();
      } catch {
        descriptions[num] = `Image for article about ${targetQuery}`;
      }
    });
    await Promise.all(descPromises);
  }

  const generatedImages: Array<{
    marker: string;
    base64?: string;
    url?: string;
    alt: string;
    success: boolean;
  }> = [];

  // 6.1 + 6.2: Генерация промптов и картинок (параллельно)
  const imagePromises = markers.map(async (markerNum, index) => {
    const desc = descriptions[markerNum] ?? `Image for article about ${targetQuery}`;

    try {
      // 6.1: Gemini Flash создаёт детальный промпт
      const sectionContext = fallbackMode
        ? ''
        : extractMarkerContext(articleHtml, markerNum);

      const detailedPrompt = await generateText({
        model: promptModel,
        systemPrompt: `Generate a detailed image generation prompt in English for an AI image generator. Output ONLY the prompt text, nothing else. Max 150 words.

MANDATORY STYLE: ${styleEN}
COLOR PALETTE: ${paletteEN}
MOOD: ${moodEN}
${excludeEN}
${imageTextOverlay ? `The image MUST contain readable text overlay: the section heading will be composited on top, so leave a clean area (top or bottom 20%) with low detail for text placement.` : 'No text, watermarks, logos, or UI elements in the image.'}

Rules:
- Start the prompt with the style: "${styleEN}".
- The image MUST visually represent the SPECIFIC topic described in the context below.
- Include concrete objects, specific details, composition, lighting that match the COLOR PALETTE and MOOD.
- Image ${parseInt(markerNum)} of ${imageCount}: ${index === 0 ? 'Hero/cover image — wide establishing shot.' : 'Section illustration — focused on specific detail.'}
- Each image must be visually DIFFERENT: vary angle, color shade, objects, composition.`,
        userMessage: `Scene description: ${desc}
Style: ${styleEN}
Palette: ${paletteEN}
Mood: ${moodEN}
Topic: ${targetQuery}
${sectionContext ? `\nFull article context around this image:\n${sectionContext}` : ''}${commentSuffix}`,
      });

      // 6.2: Seedream генерирует картинку
      const imageResult = await generateImage({
        model: genModel,
        prompt: `${styleEN}. ${detailedPrompt.trim()}`,
        size: imageSize,
      });

      // 6.3: Alt-тег — отдельный запрос к LLM на русском, 50-80 символов
      let alt = '';
      try {
        alt = await generateText({
          model: promptModel,
          systemPrompt: `Generate an alt-text in Russian for an article image. Output ONLY the alt-text, nothing else.

Rules:
- Length: strictly 50-80 characters. Not shorter than 50, not longer than 80.
- Must be a complete phrase, no trailing commas, dashes, or ellipsis.
- Describe WHAT is shown in the image, not the style.
- Include the main topic keyword naturally (not keyword stuffing).
- No brand spam, no duplicate words.

Examples:
- GOOD: "Смартфон с открытым каталогом кроссовок Nike на Poizon"
- GOOD: "Эксперт проверяет подлинность Jordan 1 под лупой"
- BAD: "Объёмная 3D-сцена с парящим в воздухе щитом-эмблемой, от которого расходятся лучи разных цветов —" (too long, trailing dash)
- BAD: "кроссовки" (too short, no context)`,
          userMessage: `Image scene: ${desc}\nArticle topic: ${targetQuery}\nMain keyword for image ${index + 1}: ${index === 0 ? targetQuery : (keywords[index % keywords.length] ?? targetQuery)}`,
        });
        alt = alt.trim().replace(/^["']|["']$/g, '').replace(/[—–\-:,;.\s]+$/, '').trim();
        if (alt.length < 50 || alt.length > 125) {
          alt = alt.length > 80 ? alt.slice(0, 80).replace(/\s\S*$/, '').trim() : alt;
          if (alt.length < 50) alt = `${alt} — ${targetQuery}`.slice(0, 80).replace(/\s\S*$/, '').trim();
        }
      } catch {
        alt = `${targetQuery} — иллюстрация ${index + 1}`.slice(0, 80);
      }

      return {
        marker: markerNum,
        base64: imageResult.b64_json,
        url: imageResult.url,
        alt,
        success: true,
      };
    } catch (err) {
      console.warn(`[step-6] Image ${markerNum} generation failed:`, err);
      return {
        marker: markerNum,
        alt: '',
        success: false,
      };
    }
  });

  const results = await Promise.allSettled(imagePromises);
  for (const r of results) {
    if (r.status === 'fulfilled') {
      generatedImages.push(r.value);
    }
  }

  // 6.4: Вставка изображений в HTML
  const altTexts: string[] = [];

  if (fallbackMode) {
    // Fallback: вставляем figure-теги позиционно, т.к. маркеров в HTML нет
    const successfulImages = generatedImages.filter(i => i.success);

    if (successfulImages.length > 0) {
      const buildFigure = async (img: (typeof successfulImages)[0]) => {
        let src = '';
        if (img.base64) {
          src = await saveImageToDisk(ctx.jobId, img.marker, img.base64);
        } else if (img.url && !img.url.startsWith('data:')) {
          src = img.url;
        } else {
          src = '';
        }
        altTexts.push(img.alt);
        if (imageTextOverlay) {
          const h2Matches = [...articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
          const h2Index = Math.min(parseInt(img.marker) - 1, h2Matches.length - 1);
          const overlayText = h2Index >= 0 && h2Matches[h2Index]
            ? h2Matches[h2Index][1].replace(/<[^>]*>/g, '').trim()
            : targetQuery;
          return `<figure style="position:relative;overflow:hidden;">
    <img src="${src}" alt="${img.alt}" loading="lazy" style="width:100%;display:block;">
    <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:18px;font-weight:600;line-height:1.3;">${overlayText}</div>
  </figure>`;
        }
        return `<figure><img src="${src}" alt="${img.alt}" loading="lazy"></figure>`;
      };

      // Собираем точки вставки (позиция = конец </p>)
      const insertions: Array<{ pos: number; html: string }> = [];

      // Первая картинка — сразу после </h1>, перед вводным абзацем
      const h1End = articleHtml.indexOf('</h1>');
      if (h1End >= 0) {
        insertions.push({
          pos: h1End + '</h1>'.length,
          html: await buildFigure(successfulImages[0]),
        });
      }

      // Остальные — равномерно после </p> в h2-блоках
      if (successfulImages.length > 1) {
        const remaining = successfulImages.slice(1);
        const h2Regex = /<h2[^>]*>/gi;
        const h2PPoints: number[] = [];
        let m;
        while ((m = h2Regex.exec(articleHtml)) !== null) {
          const pClose = articleHtml.indexOf('</p>', m.index);
          if (pClose >= 0) {
            h2PPoints.push(pClose + '</p>'.length);
          }
        }

        if (h2PPoints.length > 0) {
          const step = h2PPoints.length / remaining.length;
          for (let i = 0; i < remaining.length; i++) {
            const idx = Math.min(
              Math.floor(i * step),
              h2PPoints.length - 1,
            );
            insertions.push({
              pos: h2PPoints[idx],
              html: await buildFigure(remaining[i]),
            });
          }
        }
      }

      // Вставляем от конца к началу, чтобы позиции не сдвигались
      insertions.sort((a, b) => b.pos - a.pos);
      for (const { pos, html } of insertions) {
        articleHtml =
          articleHtml.slice(0, pos) + '\n' + html + articleHtml.slice(pos);
      }
    }
  } else {
    // Стандартный режим: замена маркеров [IMAGE_N]
    for (const img of generatedImages) {
      if (!img.success) {
        articleHtml = articleHtml.replace(
          new RegExp(`\\[IMAGE_${img.marker}\\]`, 'g'),
          '',
        );
        continue;
      }

      let src = '';
      if (img.base64) {
        src = await saveImageToDisk(ctx.jobId, img.marker, img.base64);
      } else if (img.url && !img.url.startsWith('data:')) {
        src = img.url;
      } else {
        src = '';
      }

      let figureTag: string;
      if (imageTextOverlay) {
        const beforeMarkerHtml = articleHtml.slice(0, articleHtml.indexOf(`[IMAGE_${img.marker}]`));
        const h2Matches = [...beforeMarkerHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
        const overlayText = h2Matches.length > 0
          ? h2Matches[h2Matches.length - 1][1].replace(/<[^>]*>/g, '').trim()
          : targetQuery;
        figureTag = `<figure style="position:relative;overflow:hidden;">
    <img src="${src}" alt="${img.alt}" loading="lazy" style="width:100%;display:block;">
    <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:18px;font-weight:600;line-height:1.3;">${overlayText}</div>
  </figure>`;
      } else {
        figureTag = `<figure><img src="${src}" alt="${img.alt}" loading="lazy"></figure>`;
      }

      articleHtml = articleHtml.replace(
        new RegExp(`\\[IMAGE_${img.marker}\\]`, 'g'),
        figureTag,
      );

      altTexts.push(img.alt);
    }
  }

  // Удалить все строки [IMAGE_N_DESC: ...]
  articleHtml = articleHtml.replace(/\[IMAGE_\d+_DESC:[^\]]*\]\n?/g, '');

  // Удалить оставшиеся нерасставленные маркеры
  articleHtml = articleHtml.replace(/\[IMAGE_\d+\]\n?/g, '');

  const successCount = generatedImages.filter(i => i.success).length;
  const warnings: string[] = [];
  if (successCount < imageCount) {
    warnings.push(`Сгенерировано ${successCount} из ${imageCount} изображений`);
  }

  return {
    success: true,
    data: {
      article_html: articleHtml,
      images_generated: successCount,
      images_total: imageCount,
      alt_texts: altTexts,
      warnings,
    },
    durationMs: Date.now() - start,
  };
}
