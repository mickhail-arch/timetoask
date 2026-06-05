// modules/section-generator/section.service.ts
import { generateAndMeter } from '@/modules/llm/meter';
import { SECTION_SYSTEM_PROMPT } from './prompt';
import { getOpenRouterModel, type SectionModel } from './pricing';

export interface GenerateSectionParams {
  heading: string;
  level: 'h2' | 'h3';
  targetChars: number;
  model: SectionModel;
  articleTitle?: string;
  contextBefore?: string;
  userId?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanBody(raw: string): string {
  let html = raw.trim().replace(/^```html?/i, '').replace(/```$/i, '').trim();
  // если модель не обернула в <p> — обернуть абзацы
  if (!/<p[\s>]/i.test(html)) {
    html = html
      .split(/\n{2,}/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => `<p>${para}</p>`)
      .join('');
  }
  return html;
}

export async function generateSection(params: GenerateSectionParams): Promise<string> {
  const { heading, level, targetChars, model, articleTitle, contextBefore } = params;

  const ctx = [
    articleTitle ? `Тема статьи: ${articleTitle}.` : '',
    contextBefore ? `Предыдущий текст (для связности, не повторяй его):\n${contextBefore.slice(-500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const userMessage = `${ctx ? ctx + '\n\n' : ''}Заголовок раздела (${level.toUpperCase()}): «${heading}»\n\nНапиши тело этого раздела объёмом примерно ${targetChars} символов.`;

  const raw = await generateAndMeter({
    model: getOpenRouterModel(model),
    systemPrompt: SECTION_SYSTEM_PROMPT,
    userMessage,
    temperature: 0.7,
    maxOutputTokens: Math.ceil(targetChars / 1.5) + 300,
  }, { userId: params.userId, feature: 'section' });

  const tag = level === 'h2' ? 'h2' : 'h3';
  return `<${tag}>${escapeHtml(heading)}</${tag}>${cleanBody(raw)}`;
}
