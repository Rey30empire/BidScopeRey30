export function parseJsonResponse<T>(value: string): T | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = safeParse<T>(trimmed);
  if (direct) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeParse<T>(fenced[1].trim());
    if (parsed) {
      return parsed;
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return safeParse<T>(trimmed.slice(start, end + 1));
  }

  return null;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  const parsed = parseJsonResponse<T>(value);
  return parsed ?? fallback;
}

function safeParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
