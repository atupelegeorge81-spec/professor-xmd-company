/**
 * Client-safe NDJSON stream reader.
 * Reads a fetch Response body line-by-line, parsing each line as JSON.
 */
export async function readNdjson<T>(
  res: Response,
  onEvent: (e: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = (await res.json()) as { error?: string };
      if (d.error) msg = d.error;
    } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const pump = async (): Promise<void> => {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {}
      return;
    }
    const { done, value } = await reader.read();
    if (done) {
      const tail = buf.trim();
      if (tail) {
        try {
          onEvent(JSON.parse(tail) as T);
        } catch {}
      }
      return;
    }
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as T);
      } catch {}
    }
    return pump();
  };
  await pump();
}
