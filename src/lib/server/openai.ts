import OpenAI from 'openai';
import { parseJsonResponse } from '@/lib/server/json';

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateJson<T>({
  prompt,
  label,
  model = DEFAULT_OPENAI_MODEL,
  maxRetries = 2,
}: {
  prompt: string;
  label: string;
  model?: string;
  maxRetries?: number;
}): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await getClient().responses.create({
        model,
        input: prompt,
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
