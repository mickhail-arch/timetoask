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
  inputSchema: ZodType;
  outputSchema: ZodType;
  buildUserMessage: (input: Record<string, unknown>) => string;
}
