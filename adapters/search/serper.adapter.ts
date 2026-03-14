import { env } from '@/core/config/env';

export type SerperResult = {
  title: string;
  link: string;
  snippet: string;
  position: number;
};

export type SerperResponse = {
  organic: SerperResult[];
};

export async function serperSearch(
  query: string,
  options: { gl?: string; hl?: string; num?: number } = {},
): Promise<SerperResponse> {
  const { gl = 'ru', hl = 'ru', num = 10 } = options;

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl, hl, num }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { organic?: SerperResult[] };

  return {
    organic: (data.organic ?? []).map((item, i) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      position: item.position ?? i + 1,
    })),
  };
}
