// adapters/llm/openrouter.adapter.ts — OpenRouter LLM adapter
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from 'ai';
import { env } from '@/core/config/env';
import { LlmUnavailableError } from '@/core/errors';

export type LlmParams = {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxOutputTokens?: number;
  fallbackModel?: string;
};

const provider = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

function buildMessages(params: LlmParams) {
  return [
    { role: 'system' as const, content: params.systemPrompt },
    { role: 'user' as const, content: params.userMessage },
  ];
}

function logPromptDebug(label: string, params: LlmParams) {
  if (env.NODE_ENV === 'development') {
    console.debug(
      `[llm:${label}] systemPrompt length=${params.systemPrompt.length}, userMessage length=${params.userMessage.length}`,
    );
  }
}

async function tryWithFallback<T>(
  params: LlmParams,
  execute: (model: string) => Promise<T>,
): Promise<T> {
  const fallback = params.fallbackModel ?? env.OPENROUTER_FALLBACK_MODEL;

  try {
    const result = await execute(params.model);
    console.info(`[llm] model=${params.model} status=ok`);
    return result;
  } catch (primaryErr) {
    const code =
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(
      `[llm] model=${params.model} status=fail error="${code}", trying fallback=${fallback}`,
    );
  }

  try {
    const result = await execute(fallback);
    console.info(`[llm] model=${fallback} status=ok (fallback)`);
    return result;
  } catch (fallbackErr) {
    const fbCode =
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    console.error(
      `[llm] model=${fallback} status=fail error="${fbCode}", no models available`,
    );
    throw new LlmUnavailableError();
  }
}

export async function generateText(params: LlmParams): Promise<string> {
  logPromptDebug('generateText', params);
  const messages = buildMessages(params);

  return tryWithFallback(params, async (model) => {
    const { text } = await aiGenerateText({
      model: provider(model),
      messages,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });
    return text;
  });
}

// ---------------------------------------------------------------------------
// Image generation (OpenRouter /images/generations)
// ---------------------------------------------------------------------------

export type ImageParams = {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
};

export type ImageResult = {
  url?: string;
  b64_json?: string;
};

export async function generateImage(params: ImageParams): Promise<ImageResult> {
  const { model, prompt, n = 1, size = '1024x1024' } = params;

  const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt, n, size }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[llm:generateImage] model=${model} status=${res.status} error="${text}"`,
    );
    throw new LlmUnavailableError();
  }

  const body = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  const first = body.data?.[0];
  if (!first) {
    throw new LlmUnavailableError();
  }

  console.info(`[llm:generateImage] model=${model} status=ok`);
  return { url: first.url, b64_json: first.b64_json };
}

// ---------------------------------------------------------------------------
// streamText
// ---------------------------------------------------------------------------

export async function* streamText(
  params: LlmParams,
): AsyncGenerator<string, void, undefined> {
  logPromptDebug('streamText', params);
  const messages = buildMessages(params);
  const fallback = params.fallbackModel ?? env.OPENROUTER_FALLBACK_MODEL;

  try {
    const result = aiStreamText({
      model: provider(params.model),
      messages,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
    console.info(`[llm] model=${params.model} status=ok (stream complete)`);
    return;
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    console.warn(
      `[llm] model=${params.model} status=fail error="${code}", trying fallback=${fallback}`,
    );
  }

  try {
    const fallbackResult = aiStreamText({
      model: provider(fallback),
      messages,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });

    for await (const chunk of fallbackResult.textStream) {
      yield chunk;
    }
    console.info(
      `[llm] model=${fallback} status=ok (fallback stream complete)`,
    );
  } catch (fbErr) {
    const fbCode =
      fbErr instanceof Error ? fbErr.message : String(fbErr);
    console.error(
      `[llm] model=${fallback} status=fail error="${fbCode}", no models available`,
    );
    throw new LlmUnavailableError();
  }
}
