import { admin, config, database, json, localIso, tenantSlug, timeMinutes, validDate } from '@/lib/server';
import { duration, priceFor } from '@/lib/shinslot';

export async function GET(request: Request) {
  if (!await admin(request)) return json({ error: 'Нет доступа' }, 403);
  const rows = await database()
    .prepare(
      'SELECT id,service_id as serviceId,service_name as serviceName,wheel_size as wheelSize,vehicle_type as vehicleType,add_ons as addOns,price,starts_at as startsAt,ends_at as endsAt,post,name,phone,status,created_at as createdAt FROM bookings WHERE tenant_slug=? ORDER BY starts_at DESC LIMIT 300'
    )
    .bind(tenantSlug)
    .all();
  return json({ bookings: rows.results });
}

export async function POST(request: Request) {
  const b = (await request.json()) as Record<string, unknown>;
  const c = await config();
  const service = c.services.find((x) => x.id === b.serviceId && x.enabled);
  const date = String(b.date || '');
  const time = String(b.time || '');
  const size = b.wheelSize ? Number(b.wheelSize) : 0;
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const vehicleType = String(b.vehicleType || '');

  if (
    !service ||
    !validDate(date) ||
    !/^\d{2}:\d{2}$/.test(time) ||
    name.length < 2 ||
    name.length > 80 ||
    !/^\+?[\d\s()-]{10,22}$/.test(phone)
  ) {
    return json({ error: 'Проверьте данные записи' }, 400);
  }

  const start = localIso(date, time);
  const length = duration(c, service);
  const end = new Date(new Date(start).getTime() + length * 60000).toISOString();

  if (
    new Date(start).getTime() < Date.now() + 15 * 60000 ||
    new Date(start).getTime() > Date.now() + 45 * 86400000 ||
    timeMinutes(time) < timeMinutes(c.open) ||
    timeMinutes(time) + length > timeMinutes(c.close) ||
    !c.workDays.includes(new Date(`${date}T12:00:00+03:00`).getUTCDay()) ||
    c.closedDates.includes(date) ||
    timeMinutes(time) % 30 !== 0
  ) {
    return json({ error: 'Время недоступно' }, 400);
  }

  const runflat = Boolean(b.runflat);
  const price = priceFor(c, service, size, vehicleType, runflat);
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const status = c.mode === 'instant' && !service.inspection ? 'confirmed' : 'pending';

  const result = await database()
    .prepare(
      `INSERT INTO bookings (id,tenant_slug,service_id,service_name,wheel_size,vehicle_type,add_ons,price,starts_at,ends_at,post,name,phone,status,cancel_token,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,p.n,?,?,?,?,? FROM (WITH RECURSIVE posts(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM posts WHERE n < ?) SELECT n FROM posts) p
    WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.tenant_slug=? AND b.post=p.n AND b.status!='cancelled' AND b.starts_at<? AND b.ends_at>?) ORDER BY p.n LIMIT 1 RETURNING id,post`
    )
    .bind(
      id,
      tenantSlug,
      service.id,
      service.name,
      size,
      vehicleType,
      JSON.stringify(runflat ? ['RunFlat'] : []),
      price,
      start,
      end,
      name,
      phone,
      status,
      token,
      new Date().toISOString(),
      c.posts,
      tenantSlug,
      end,
      start
    )
    .first<{ id: string; post: number }>();

  if (!result) return json({ error: 'Этот слот только что заняли. Выберите другое время.' }, 409);
  return json({ id, status, price, post: result.post, cancelToken: token, startsAt: start }, 201);
}
