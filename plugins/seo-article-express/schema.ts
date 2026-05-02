import { z } from 'zod';

export const inputSchema = z.object({
  target_query: z.string().min(3).max(200).describe('Целевой поисковый запрос'),
  keywords: z.string().min(1).describe('Ключевые слова (по одному на строку)'),
  intent: z.enum([
    'informational', 'educational', 'commercial', 'comparative',
    'review', 'news', 'problem_solution',
  ]).default('informational').describe('Intent запроса'),
  target_char_count: z.number().min(6000).max(20000).default(8000).describe('Объём статьи в символах'),
  image_count: z.number().min(0).max(11).default(0).describe('Количество изображений'),

  tone_of_voice: z.string().max(300).default('expert').describe('Tone of voice'),
  tone_comment: z.string().max(300).optional().describe('Комментарий к стилю текста'),
  target_audience: z.object({
    gender: z.enum(['all', 'male', 'female']).default('all'),
    age: z.array(z.string()).default(['all']),
  }).default({ gender: 'all', age: ['all'] }).describe('Целевая аудитория'),
  geo_location: z.string().max(200).optional().describe('Гео (город или регион)'),
  image_style: z.array(z.string()).max(2).optional().describe('Стиль изображений'),
  image_comment: z.string().max(300).optional().describe('Дополнение к стилю изображений'),
  image_text_overlay: z.boolean().default(false).describe('Добавлять текст H2 на картинку'),
  image_aspect: z.enum(['16:9', '1:1', '9:16']).default('16:9').describe('Соотношение сторон изображений'),
  image_palette: z.enum(['warm', 'cold', 'pastel', 'vibrant', 'monochrome', 'custom']).default('warm').optional().describe('Цветовая палитра'),
  image_palette_hex: z.string().max(50).optional().describe('HEX-цвета для палитры custom'),
  image_mood: z.enum(['professional', 'cozy', 'tech', 'nature', 'medical']).default('professional').optional().describe('Настроение изображений'),
  image_exclude: z.string().max(200).optional().describe('Что исключить из изображений'),

  ai_model: z.enum(['gemini', 'sonnet', 'opus47']).default('opus47').describe('Модель для генерации статьи'),
  analysis_model: z.enum(['sonnet', 'opus47']).default('sonnet').describe('Модель для анализа и правок текста'),
  metadata_model: z.enum(['sonnet', 'opus47', 'gemini_flash']).default('sonnet').describe('Модель для генерации метаданных'),
  comparison_enabled: z.boolean().default(false).describe('Включить блок сравнения'),
  // Лимиты comparison_objects / comparison_criteria контролируются на клиенте по объёму статьи
  // (≤9000 симв → 2/3, ≤12000 → 3/4, ≤16000 → 4/4, >16000 → 5/5).
  // Серверная валидация намеренно ослаблена — LLM просто рисует то, что пришло в input.
  comparison_objects: z.number().int().min(2).max(5).default(3).describe('Количество объектов сравнения'),
  comparison_criteria: z.number().int().min(2).max(5).default(3).describe('Количество критериев сравнения'),
  faq_count: z.number().min(0).max(10).default(5).describe('Количество FAQ-вопросов'),
  brand: z.string().max(100).optional().describe('Бренд'),
  brand_url: z.string().url().max(300).optional().describe('Ссылка на бренд'),
  brand_description: z.string().max(300).optional().describe('Краткое описание компании/бренда'),
  cta: z.string().max(200).optional().describe('Текст CTA'),
  cta_url: z.string().url().optional().describe('Ссылка в CTA'),
  cta_type: z.enum(['service', 'product']).optional().describe('Тип CTA: услуга или товар'),
  cta_style: z.enum(['native', 'standard']).default('standard').optional().describe('Стиль встройки CTA'),
  cta_position: z.enum(['start', 'middle', 'end', 'all']).default('end').optional().describe('Позиция CTA в статье'),
  internal_links: z.array(z.object({
    url: z.string().url(),
    anchor: z.string().max(100),
  })).max(5).optional().describe('Перелинковка — ссылки на свои страницы'),
  source_links: z.array(z.object({
    url: z.string().url(),
    anchor: z.string().max(100),
  })).max(5).optional().describe('Ссылки на источники — внешние авторитетные ресурсы'),
  forbidden_words: z.string().optional().describe('Запрещённые слова (по одному на строку)'),
  legal_restrictions: z.string().max(500).optional().describe('Юридические ограничения'),

  // Блок автора (E-E-A-T)
  author_name: z.string().max(100).optional().describe('ФИО автора статьи'),
  author_position: z.string().max(100).optional().describe('Должность автора'),
  author_company: z.string().max(100).optional().describe('Компания автора'),
  author_url: z.string().url().max(300).optional().describe('Ссылка на профиль автора'),
  publication_date: z.string().max(20).optional().describe('Дата публикации (ДД.ММ.ГГГГ)'),
});

export type SeoArticleInput = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  article_html: z.string().describe('HTML статьи с inline-стилями'),
  article_docx_base64: z.string().describe('Статья в формате .docx (base64)'),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    breadcrumb: z.string(),
    alt_texts: z.array(z.string()),
    json_ld: z.string(),
  }).describe('Метаданные для вставки'),
  quality_metrics: z.object({
    ai_score: z.number(),
    water: z.number(),
    spam: z.number(),
    nausea_classic: z.number(),
    nausea_academic: z.number(),
    uniqueness: z.number(),
    readability: z.number(),
    char_count: z.number(),
    word_count: z.number(),
    h2_count: z.number(),
    h3_count: z.number(),
    image_count: z.number(),
    faq_count: z.number(),
  }).describe('Панель качества'),
  seo_issues: z.array(z.object({
    id: z.string(),
    group: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    message: z.string(),
  })).describe('SEO-проблемы'),
});

export type SeoArticleOutput = z.infer<typeof outputSchema>;
