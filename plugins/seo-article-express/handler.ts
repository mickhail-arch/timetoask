import type { SeoArticleInput } from './schema';

export function buildUserMessage(input: SeoArticleInput): string {
  const lines: string[] = [];

  lines.push(`Тема статьи: ${input.target_query}`);
  lines.push(`Ключевые слова: ${input.keywords}`);
  lines.push(`Intent: ${input.intent}`);
  lines.push(`Целевой объём: ${input.target_char_count} символов`);
  lines.push(`Изображений: ${input.image_count}`);

  if (input.tone_of_voice && input.tone_of_voice !== 'expert') {
    lines.push(`Tone of voice: ${input.tone_of_voice}`);
  }
  if (input.target_audience) {
    const { gender, age } = input.target_audience;
    if (gender !== 'all') lines.push(`Пол аудитории: ${gender}`);
    if (age.length > 0 && age[0] !== 'all') lines.push(`Возраст аудитории: ${age.join(', ')}`);
  }
  if (input.geo_location) lines.push(`Гео: ${input.geo_location}`);
  if (input.image_style?.length) lines.push(`Стиль изображений: ${input.image_style.join(', ')}`);
  if (input.faq_count) lines.push(`FAQ вопросов: ${input.faq_count}`);
  if (input.brand) lines.push(`Бренд: ${input.brand}`);
  if (input.cta) lines.push(`CTA: ${input.cta}`);
  if (input.source_links?.length) {
    const formatted = input.source_links.map((s) => `${s.anchor}: ${s.url}`).join('\n');
    lines.push(`Ссылки на источники:\n${formatted}`);
  }
  if (input.forbidden_words) lines.push(`Запрещённые слова: ${input.forbidden_words}`);
  if (input.legal_restrictions) lines.push(`Юридические ограничения: ${input.legal_restrictions}`);

  return lines.join('\n');
}
