import { bucket, json } from '@/lib/server';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Фото не найдено' }, 404);
  const object = await bucket.get(`hero/${id}`);
  if (!object) return json({ error: 'Фото не найдено' }, 404);
  return new Response(Buffer.from(object.body), {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
