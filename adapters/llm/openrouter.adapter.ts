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

    if (!fallback) {
      throw new LlmUnavailableError(
        `No fallback model configured, original error: ${code}`,
      );
    }
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
    const timeoutMs = model.includes('opus')
      ? 420_000
      : model.includes('claude')
        ? 180_000
        : model.includes('deepseek')
          ? 90_000
          : 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { text } = await aiGenerateText({
        model: provider(model),
        messages,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        abortSignal: controller.signal,
      });
      return text;
    } finally {
      clearTimeout(timer);
    }
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

function isGeminiImageModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes('gemini') && lower.includes('image');
}

function extractBase64FromGeminiResponse(content: unknown): string | null {
  if (typeof content === 'string') {
    const match = content.match(/data:image\/[^;]+;base64,([\s\S]+)/);
    return match ? match[1].trim() : null;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        const url: string = part.image_url.url;
        const match = url.match(/data:image\/[^;]+;base64,([\s\S]+)/);
        return match ? match[1].trim() : null;
      }
      if (part?.inline_data?.data) {
        return part.inline_data.data;
      }
    }
  }

  return null;
}

async function generateImageGemini(
  model: string,
  prompt: string,
): Promise<ImageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const requestBody = {
      model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    };
    console.debug('[llm:generateImage:gemini] Request body:', JSON.stringify(requestBody));

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.debug(
        `[llm:generateImage:gemini] model=${model} status=${res.status} response: ${errText.slice(0, 500)}`,
      );
      throw new LlmUnavailableError();
    }

    const body = await res.json();
    console.debug(
      `[llm:generateImage:gemini] model=${model} full response: ${JSON.stringify(body).slice(0, 500)}`,
    );

    const message = body?.choices?.[0]?.message;
    const images: Array<{ image_url?: { url?: string } }> | undefined =
      message?.images;

    if (Array.isArray(images) && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url;
      if (imageUrl) {
        const b64 = imageUrl.startsWith('data:image/')
          ? imageUrl.slice(imageUrl.indexOf(',') + 1)
          : null;

        if (b64) {
          console.info(`[llm:generateImage:gemini] model=${model} status=ok (from message.images)`);
          return { url: imageUrl, b64_json: b64 };
        }

        console.info(`[llm:generateImage:gemini] model=${model} status=ok (non-data url from message.images)`);
        return { url: imageUrl };
      }
    }

    const content = message?.content;
    if (content != null) {
      const b64 = extractBase64FromGeminiResponse(content);
      if (b64) {
        console.info(`[llm:generateImage:gemini] model=${model} status=ok (from content fallback)`);
        return { b64_json: b64 };
      }
    }

    console.debug(
      `[llm:generateImage:gemini] model=${model} no image found in message.images or content`,
    );
    throw new LlmUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

async function generateImageStandard(
  params: ImageParams,
): Promise<ImageResult> {
  const { model, prompt, n = 1, size = '1024x1024' } = params;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, prompt, n, size }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.debug(
        `[llm:generateImage] model=${model} status=${res.status} response: ${errText.slice(0, 500)}`,
      );
      throw new LlmUnavailableError();
    }

    const body = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };

    console.debug(
      `[llm:generateImage] model=${model} full response: ${JSON.stringify(body).slice(0, 500)}`,
    );

    const first = body.data?.[0];
    if (!first) {
      throw new LlmUnavailableError();
    }

    console.info(`[llm:generateImage] model=${model} status=ok`);
    return { url: first.url, b64_json: first.b64_json };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage(params: ImageParams): Promise<ImageResult> {
  if (isGeminiImageModel(params.model)) {
    return generateImageGemini(params.model, params.prompt);
  }
  return generateImageStandard(params);
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
