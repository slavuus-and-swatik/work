import { admin, database, json, tenantSlug } from '@/lib/server';
import { readJson, JsonRequestError } from '@/lib/read-json';

export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  const token=new URL(request.url).searchParams.get('token');
  if (!token) return json({error:'Нет доступа'},403);
  const booking=await database().prepare('SELECT id,service_name as serviceName,wheel_size as wheelSize,starts_at as startsAt,status FROM bookings WHERE id=? AND tenant_slug=? AND cancel_token=?').bind(id,tenantSlug,token).first();
  return booking ? json({booking}) : json({error:'Запись не найдена'},404);
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let parsed: unknown;
  try { parsed = await readJson<unknown>(request, 4 * 1024); }
  catch (error) {
    if (error instanceof JsonRequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Некорректный запрос записи' }, 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Некорректный запрос записи' }, 400);
  const body = parsed as { status?: unknown; cancelToken?: unknown };
  const isAdmin = Boolean(await admin(request));
  if (typeof body.status !== 'string' || !['confirmed', 'pending', 'cancelled'].includes(body.status)) return json({ error: 'Неверный статус записи' }, 400);
  if (!isAdmin && (body.status !== 'cancelled' || typeof body.cancelToken !== 'string' || body.cancelToken.length > 128)) {
    return json({ error: 'Нет доступа' }, 403);
  }
  const query = isAdmin
    ? 'UPDATE bookings SET status=? WHERE id=? AND tenant_slug=?'
    : "UPDATE bookings SET status=? WHERE id=? AND tenant_slug=? AND cancel_token=? AND status IN ('pending','confirmed')";
  const values = isAdmin
    ? [body.status, id, tenantSlug]
    : [body.status, id, tenantSlug, body.cancelToken];
  const result = await database().prepare(query).bind(...values).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: 'Запись не найдена или уже не может быть отменена' }, 404);
}
