export async function parseApiResponse<T>(
  res: Response,
  fallbackError = 'Request failed.'
): Promise<T> {
  const raw = await res.text();
  let parsed: (T & { error?: string }) | null = null;

  if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
    try {
      parsed = JSON.parse(raw) as T & { error?: string };
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    if (res.status === 404) {
      throw new Error(
        'Backend API endpoint not found (404). Redeploy with the /api serverless handler enabled.'
      );
    }
    const snippet = raw.replace(/<[^>]+>/g, ' ').trim().slice(0, 140);
    throw new Error(snippet || `${fallbackError} (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(parsed.error || `${fallbackError} (HTTP ${res.status})`);
  }

  return parsed;
}
