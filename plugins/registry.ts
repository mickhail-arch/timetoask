// plugins/registry.ts — Tool registry: FS manifests ↔ DB ↔ Redis cache
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { TOOL_CACHE_TTL_SEC } from '@/core/constants';
import type { ResolvedTool, ToolStatus, ExecutionMode, ToolConfig } from '@/core/types';

const PLUGINS_DIR = join(process.cwd(), 'plugins');
const CACHE_PREFIX = 'tool:';

interface Manifest {
  id: string;
  model: string;
  executionMode: string;
  token_cost: number;
  free_uses_limit: number;
  output_format: string;
  status: string;
  config?: Record<string, unknown>;
}

export class ToolRegistry {
  /**
   * Scan every plugin dir, upsert into DB.
   * create: all fields from manifest + prompt.ts
   * update: ONLY version — never overwrite model, promptText, status, token_cost
   */
  static async initialize(): Promise<void> {
    const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
    const dirs = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith('_'),
    );

    for (const dir of dirs) {
      const manifestPath = join(PLUGINS_DIR, dir.name, 'manifest.json');
      const raw = await readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(raw);

      let promptText = '';
      try {
        const promptModule = await import(
          `@/plugins/${dir.name}/prompt`
        );
        promptText = promptModule.systemPrompt ?? '';
      } catch {
        // prompt.ts is optional
      }

      await prisma.tool.upsert({
        where: { slug: manifest.id },
        create: {
          slug: manifest.id,
          name: manifest.id,
          model: manifest.model,
          promptText,
          status: manifest.status,
          executionMode: manifest.executionMode,
          tokenCost: manifest.token_cost,
          freeUsesLimit: manifest.free_uses_limit,
          config: manifest.config ?? null,
          version: 1,
        },
        update: {
          version: { increment: 1 },
        },
      });
    }
  }

  /**
   * Resolve a tool by slug: Cache → FS (schema+handler) → DB (prompt+model+status).
   * Returns null if tool is disabled or not found.
   */
  static async resolve(toolId: string): Promise<ResolvedTool | null> {
    const cacheKey = `${CACHE_PREFIX}${toolId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as ResolvedTool;
      if (parsed.status === 'disabled') return null;

      const fsModule = await import(`@/plugins/${toolId}/index`);
      parsed.inputSchema = fsModule.inputSchema;
      parsed.outputSchema = fsModule.outputSchema;
      parsed.buildUserMessage = fsModule.buildUserMessage;
      return parsed;
    }

    const dbTool = await prisma.tool.findUnique({ where: { slug: toolId } });
    if (!dbTool) return null;
    if (dbTool.status === 'disabled') return null;

    let fsModule: {
      inputSchema: ResolvedTool['inputSchema'];
      outputSchema: ResolvedTool['outputSchema'];
      buildUserMessage: ResolvedTool['buildUserMessage'];
    };
    try {
      fsModule = await import(`@/plugins/${toolId}/index`);
    } catch {
      return null;
    }

    const resolved: ResolvedTool = {
      id: dbTool.id,
      name: dbTool.name,
      slug: dbTool.slug,
      model: dbTool.model,
      promptText: dbTool.promptText,
      status: dbTool.status as ToolStatus,
      executionMode: dbTool.executionMode as ExecutionMode,
      tokenCost: dbTool.tokenCost,
      freeUsesLimit: dbTool.freeUsesLimit,
      config: (dbTool.config as ToolConfig) ?? null,
      inputSchema: fsModule.inputSchema,
      outputSchema: fsModule.outputSchema,
      buildUserMessage: fsModule.buildUserMessage,
    };

    const serializable = {
      id: resolved.id,
      name: resolved.name,
      slug: resolved.slug,
      model: resolved.model,
      promptText: resolved.promptText,
      status: resolved.status,
      executionMode: resolved.executionMode,
      tokenCost: resolved.tokenCost,
      freeUsesLimit: resolved.freeUsesLimit,
      config: resolved.config,
    };
    await redis.setex(cacheKey, TOOL_CACHE_TTL_SEC, JSON.stringify(serializable));

    return resolved;
  }

  /** Invalidate cached tool data — call after admin PATCH */
  static async invalidateCache(toolId: string): Promise<void> {
    await redis.del(`${CACHE_PREFIX}${toolId}`);
  }
}
