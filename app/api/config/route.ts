import { admin, config, database, json, tenant, tenantSlug } from '@/lib/server';
import { defaultConfig, type Config } from '@/lib/shinslot';

export async function GET(request: Request) {
  const draft = new URL(request.url).searchParams.get('draft') === '1';
  if (draft && !(await admin(request))) return json({ error: 'Требуется вход в админку' }, 403);
  return json({ config: await config(!draft), isAdmin: Boolean(await admin(request)) });
}

export async function PUT(request: Request) {
  const id = await admin(request);
  if (!id) return json({ error: 'Требуется вход в админку' }, 403);
  const body = (await request.json()) as { config?: Config; publish?: boolean };
  const c = body.config;
  if (!c || typeof c.name !== 'string' || !Array.isArray(c.services) || !Number.isInteger(c.posts) || c.posts < 1 || c.posts > 20) {
    return json({ error: 'Проверьте настройки' }, 400);
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    return json({ error: 'Проверьте адрес почты' }, 400);
  }
  const now = new Date().toISOString();
  const row = await tenant();
  const published = body.publish ? JSON.stringify(c) : row?.published ?? JSON.stringify(defaultConfig);
  await database()
    .prepare(
      'INSERT INTO tenants (slug,owner_id,draft,published,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET draft=excluded.draft,published=excluded.published,updated_at=excluded.updated_at'
    )
    .bind(tenantSlug, id, JSON.stringify(c), published, now)
    .run();
  return json({ ok: true, published: Boolean(body.publish) });
}
