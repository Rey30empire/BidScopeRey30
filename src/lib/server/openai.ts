import OpenAI from 'openai';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseJsonResponse } from '@/lib/server/json';

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = Number.isFinite(Number(process.env.OPENAI_TIMEOUT_MS))
  ? Math.max(15000, Number(process.env.OPENAI_TIMEOUT_MS))
  : 90000;

let client: OpenAI | null = null;
let clientApiKey: string | null = null;

const LOCAL_OPENAI_SOURCES = [
  join(process.cwd(), '.env.local'),
  join(process.cwd(), '.env'),
  join(process.cwd(), 'BitScopeRey30+Datos', 'bidScoperey30 .MD'),
];

function extractLocalApiKey(): string | null {
  for (const filePath of LOCAL_OPENAI_SOURCES) {
    if (!existsSync(filePath)) {
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf8');

      if (filePath.endsWith('.env') || filePath.endsWith('.env.local')) {
        const envMatch = content.match(/^OPENAI_API_KEY=(?:"|')?([^\r\n"']+)(?:"|')?$/m);
        if (envMatch?.[1]?.trim()) {
          return envMatch[1].trim();
        }
      }

      const keyMatch = content.match(/sk-(?:svcacct|proj|live|test)-[A-Za-z0-9_-]+/);
      if (keyMatch?.[0]) {
        return keyMatch[0];
      }
    } catch {
      continue;
    }
  }

  return null;
}

function resolveApiKey(): string {
  const localKey = extractLocalApiKey();
  if (localKey) {
    return localKey;
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  throw new Error('OPENAI_API_KEY is not configured.');
}

function getClient(): OpenAI {
  const apiKey = resolveApiKey();

  if (!client || clientApiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return client;
}

export function isOpenAIConfigured(): boolean {
  try {
    return Boolean(resolveApiKey());
  } catch {
    return false;
  }
}

export async function generateJson<T>({
  prompt,
  label,
  model = DEFAULT_OPENAI_MODEL,
  maxRetries = 2,
  timeoutMs = DEFAULT_OPENAI_TIMEOUT_MS,
}: {
  prompt: string;
  label: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await getClient().responses.create({
        model,
        input: prompt,
      }, {
        timeout: timeoutMs,
        maxRetries: 0,
      });

      const text = response.output_text?.trim();
      if (!text) {
        throw new Error(`OpenAI returned an empty response for ${label}.`);
      }

      const parsed = parseJsonResponse<T>(text);
      if (!parsed) {
        throw new Error(`OpenAI returned non-JSON output for ${label}.`);
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error(`OpenAI request failed for ${label}.`);
}
