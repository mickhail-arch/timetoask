// lib/api-helpers.ts — Shared route handler utilities
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/core/errors';

export const unauthorized = () =>
  NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 } },
    { status: 401 },
  );

export function apiError(e: unknown, label: string): NextResponse {
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: e.errors[0].message, statusCode: 400 } },
      { status: 400 },
    );
  }
  if (e instanceof AppError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, statusCode: e.statusCode } },
      { status: e.statusCode },
    );
  }
  console.error(`[${label}]`, e);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 } },
    { status: 500 },
  );
}
