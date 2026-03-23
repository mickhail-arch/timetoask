const URL_RE =
  /^https?:\/\/[a-zA-Z0-9а-яА-ЯёЁ][a-zA-Z0-9а-яА-ЯёЁ.-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(\/\S*)?$/;

export function isValidUrl(value: string): boolean {
  return URL_RE.test(value);
}

export function formatUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getUrlError(value: string): string | null {
  if (!value.trim()) return null;
  if (isValidUrl(value.trim())) return null;
  return 'Введите корректный URL (https://example.com)';
}
