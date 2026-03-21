// modules/seo/steps/step-6-images.ts — генерация изображений по финальному тексту
import type { StepResult, PipelineContext } from '../types';
import { getStepModel } from '../config';
import { generateText, generateImage } from '@/adapters/llm/openrouter.adapter';
import type { ToolConfig } from '@/core/types';

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
  const genModel = getStepModel(config, 'image_gen', 'bytedance/seedream-4.5');

  // Получить статью из предыдущего шага (после правок)
  const revisionsData = ctx.data.ai_detect_revisions as Record<string, unknown>
    ?? ctx.data.step_5 as Record<string, unknown>
    ?? {};
  let articleHtml = (revisionsData.article_html as string) ?? '';

  // Получить стили изображений
  const imageStyles = (ctx.input.image_style as string[]) ?? ['realistic'];
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

  // Найти маркеры [IMAGE_N] и описания [IMAGE_N_DESC: ...]
  const markerRegex = /\[IMAGE_(\d+)\]/g;
  const descRegex = /\[IMAGE_(\d+)_DESC:\s*([^\]]+)\]/g;

  const descriptions: Record<string, string> = {};
  let descMatch;
  while ((descMatch = descRegex.exec(articleHtml)) !== null) {
    descriptions[descMatch[1]] = descMatch[2].trim();
  }

  const markers: string[] = [];
  let markerMatch;
  while ((markerMatch = markerRegex.exec(articleHtml)) !== null) {
    if (!markers.includes(markerMatch[1])) {
      markers.push(markerMatch[1]);
    }
  }

  // Основной ключ для alt-тегов
  const targetQuery = (ctx.input.target_query as string) ?? '';
  const keywords = ((ctx.input.keywords as string) ?? '').split('\n').filter(Boolean);

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
      const detailedPrompt = await generateText({
        model: promptModel,
        systemPrompt: 'Generate a detailed image generation prompt in English. Output ONLY the prompt text, nothing else. Max 200 words.',
        userMessage: `Scene description: ${desc}\nStyle: ${styleEN}\nTopic: ${targetQuery}`,
      });

      // 6.2: Seedream генерирует картинку
      const imageResult = await generateImage({
        model: genModel,
        prompt: detailedPrompt.trim(),
        size: '1792x1024',
      });

      // 6.3: Alt-тег
      const alt = index === 0
        ? `${targetQuery} ${desc}`.slice(0, 125)
        : `${keywords[index % keywords.length] ?? targetQuery} ${desc}`.slice(0, 125);

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

  // 6.4: Замена маркеров в HTML
  const altTexts: string[] = [];

  for (const img of generatedImages) {
    if (!img.success) {
      articleHtml = articleHtml.replace(
        new RegExp(`\\[IMAGE_${img.marker}\\]`, 'g'),
        '',
      );
      continue;
    }

    const src = img.base64
      ? `data:image/png;base64,${img.base64}`
      : img.url ?? '';

    const figureTag = `<figure><img src="${src}" alt="${img.alt}" loading="lazy"></figure>`;

    articleHtml = articleHtml.replace(
      new RegExp(`\\[IMAGE_${img.marker}\\]`, 'g'),
      figureTag,
    );

    altTexts.push(img.alt);
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
