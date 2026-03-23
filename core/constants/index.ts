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
export const MAX_CONCURRENT_GLOBAL = 50;
export const MAX_CONCURRENT_PER_USER = 5;

export { RUSSIAN_CITIES, RUSSIAN_REGIONS, searchCities, searchRegions, searchGeo } from './russian-geo';

