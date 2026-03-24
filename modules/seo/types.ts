// modules/seo/types.ts — типы SEO-пайплайна

export interface StepResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
  durationMs: number;
  requiresConfirmation?: boolean;
}

export interface BriefHeading {
  level: 'h1' | 'h2' | 'h3';
  text: string;
  children?: BriefHeading[];
}

export interface BriefData {
  h1: string;
  h2_list: Array<{
    text: string;
    h3s: string[];
    thesis: string;
    facts: string[];
    target_keywords?: string[];
  }>;
  subtopics: string[];
  lsi_keywords: string[];
  featured_snippet_spec?: string;
  main_keyword: string;
  main_keyword_min: number;
  main_keyword_max: number;
  keys_per_section: number;
  cta_position?: string;
  brand_mentions: number;
  geo_mentions: number;
}

export interface QualityMetrics {
  ai_score: number;
  water: number;
  spam: number;
  nausea_classic: number;
  nausea_academic: number;
  uniqueness: number;
  readability: number;
  char_count: number;
  word_count: number;
  h2_count: number;
  h3_count: number;
  image_count: number;
  faq_count: number;
}

export interface SeoIssue {
  id: string;
  group: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  location?: string;
  fix_instruction?: string;
}

export type PipelineStatus =
  | 'processing'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed';

export interface PipelineState {
  jobId: string;
  status: PipelineStatus;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  progress: number;
  partialData?: string;
  brief?: BriefData;
  result?: Record<string, unknown>;
  error?: string;
  failedStep?: string;
  calculatedPrice?: number;
  priceBreakdown?: PriceBreakdown;
  moderationCategory?: 'A' | 'B' | 'C' | 'OK';
  qualityMetrics?: QualityMetrics;
  warnings?: string[];
  originalInput?: Record<string, unknown>;
}

export interface PriceBreakdown {
  base: number;
  chars: number;
  images: number;
  faq: number;
  total: number;
}

export interface StepDefinition {
  name: string;
  displayName: string;
  execute: (ctx: PipelineContext) => Promise<StepResult>;
}

export interface PipelineContext {
  jobId: string;
  userId: string;
  input: Record<string, unknown>;
  config: Record<string, unknown> | null;
  data: Record<string, unknown>;
}
