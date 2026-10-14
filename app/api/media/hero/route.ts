import { admin, bucket, json } from '@/lib/server';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  if (!await admin(request)) return json({ error: 'Нет доступа' }, 403);
  const form = await request.formData();
  const file = form.get('photo');
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return json({ error: 'Выберите JPG, PNG или WebP до 5 МБ' }, 400);
  }
  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes.slice(0, 12));
  const jpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const png = signature.slice(0, 8).every((value, index) => value === [137,80,78,71,13,10,26,10][index]);
  const webp = String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
  if ((file.type === 'image/jpeg' && !jpeg) || (file.type === 'image/png' && !png) || (file.type === 'image/webp' && !webp)) {
    return json({ error: 'Файл не похож на изображение выбранного формата' }, 400);
  }
  const id = crypto.randomUUID();
  await bucket.put(`hero/${id}`, bytes, { httpMetadata: { contentType: file.type } });
  return json({ url: `/api/media/hero/${id}` }, 201);
}
