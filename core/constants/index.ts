// core/constants/index.ts — Application-wide constants

export const FREE_USES_START_OF_TIME = new Date(0);
export const MAX_PASSWORD_ATTEMPTS = 10;
export const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_TOKEN_COST = 100;
