// core/types/index.ts — Domain types
import type { ZodType } from 'zod';

export type UserId = string & { __brand: 'UserId' };
export type ToolId = string & { __brand: 'ToolId' };
export type JobId = string & { __brand: 'JobId' };

export type ApiResponse<T> = { data: T };
export type ApiError = {
  error: { code: string; message: string; statusCode: number };
};

export type ExecutionMode = 'sync' | 'async';
export type ToolStatus = 'active' | 'disabled' | 'beta';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Маппинг "шаг пайплайна → модель OpenRouter". Ключи — логические имена шагов. */
export type StepModelsConfig = Record<string, string>;

/** Полная конфигурация плагина из manifest.json поле config */
export interface ToolConfig {
  models?: StepModelsConfig;
  pricing?: {
    base: number;
    perCharBlock: number;
    perImage: number;
    perFaq: number;
    charBlockSize: number;
  };
  [key: string]: unknown;
}

export interface ResolvedTool {
  id: string;
  name: string;
  slug: string;
  model: string;
  promptText: string;
  status: ToolStatus;
  executionMode: ExecutionMode;
  tokenCost: number;
  freeUsesLimit: number;
  config: ToolConfig | null;
  inputSchema: ZodType;
  outputSchema: ZodType;
  buildUserMessage: (input: Record<string, unknown>) => string;
}
