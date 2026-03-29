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
  target_audience: z.object({
    gender: z.enum(['all', 'male', 'female']).default('all'),
    age: z.array(z.string()).default(['all']),
  }).default({ gender: 'all', age: ['all'] }).describe('Целевая аудитория'),
  geo_location: z.string().max(200).optional().describe('Гео (город или регион)'),
  image_style: z.array(z.string()).max(2).optional().describe('Стиль изображений'),

  faq_count: z.number().min(0).max(10).default(5).describe('Количество FAQ-вопросов'),
  brand: z.string().max(100).optional().describe('Бренд'),
  brand_url: z.string().url().max(300).optional().describe('Ссылка на бренд'),
  brand_description: z.string().max(300).optional().describe('Краткое описание компании/бренда'),
  cta: z.string().max(500).optional().describe('CTA в конце статьи'),
  cta_url: z.string().url().max(300).optional().describe('Ссылка в CTA'),
  external_links: z.array(z.object({
    url: z.string().url(),
    anchor: z.string().max(100),
  })).max(5).optional().describe('Внешние ссылки с анкорами'),
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
