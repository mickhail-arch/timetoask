// core/constants/index.ts — Application-wide constants

export const FREE_USES_START_OF_TIME = new Date(0);
export const MAX_PASSWORD_ATTEMPTS = 10;
export const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_TOKEN_COST = 100;
export const STALE_RESERVE_CUTOFF_MS = 30 * 60 * 1000;
export const STALE_JOB_BUFFER_MS = 60_000;
export const DELETED_ACCOUNT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TOOL_CACHE_TTL_SEC = 30;

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 min
export const MAX_VERIFICATION_ATTEMPTS = 5;
export const RESEND_CODE_COOLDOWN_SEC = 60;

export const KEYWORDS_GENERATION_COST = 10; // токенов за AI-генерацию ключей (1 токен = 1₽)
export const KEYWORDS_MAX_TOTAL = 15; // максимум ключей суммарно (анти-переспам)
export const KEYWORDS_MODEL = 'google/gemini-3.1-pro-preview';

export { RUSSIAN_CITIES, RUSSIAN_REGIONS, searchCities, searchRegions, searchGeo } from './russian-geo';

