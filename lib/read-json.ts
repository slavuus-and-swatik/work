export class JsonRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new JsonRequestError('Некорректный размер запроса', 400);
    if (Number(contentLength) > maxBytes) throw new JsonRequestError('Запрос слишком большой', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new JsonRequestError('Пустой запрос', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new JsonRequestError('Запрос слишком большой', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof JsonRequestError) throw error;
    throw new JsonRequestError('Не удалось прочитать запрос', 400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new JsonRequestError('Некорректная кодировка запроса', 400); }
  try { return JSON.parse(raw) as T; }
  catch { throw new JsonRequestError('Некорректный JSON', 400); }
}
