export class JsonRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new JsonRequestError('Запрос слишком большой', 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new JsonRequestError('Запрос слишком большой', 413);
  try { return JSON.parse(raw) as T; }
  catch { throw new JsonRequestError('Некорректный JSON', 400); }
}
