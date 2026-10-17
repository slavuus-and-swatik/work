import { DEFAULT_DELIVERY_PRICING, type Config } from './shinslot';
import { getActiveConfig } from './site-config';
import { isTrustedAdmin } from './admin-auth';
import { ensurePostgresSchema, getPostgresPool, postgresDatabase } from './postgres';

export const tenantSlug = 'demo';

export type TenantRow = {
  slug: string;
  owner_id: string | null;
  draft: string;
  published: string;
  updated_at: string;
};

export type BookingRow = {
  id: string;
  tenant_slug: string;
  service_id: string;
  service_name: string;
  wheel_size: number;
  vehicle_type: string;
  add_ons: string;
  price: number;
  starts_at: string;
  ends_at: string;
  post: number;
  name: string;
  phone: string;
  status: string;
  cancel_token: string;
  created_at: string;
};

export type OrderRow = {
  id: string;
  tenant_slug: string;
  items_json: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  subtotal?: number;
  discount?: number;
  delivery_cost?: number;
  rejection_reason?: string;
  customer_access_token?: string;
  payment_method: 'online' | 'cash' | 'transfer';
  payment_status: 'paid' | 'pending';
  status: 'new' | 'processing' | 'completed' | 'cancelled';
  comment?: string;
  created_at: string;
};

// Global in-memory storage to survive HMR in dev and persist for current process
const globalState = globalThis as unknown as {
  __shinslot_tenants?: Map<string, TenantRow>;
  __shinslot_bookings?: BookingRow[];
  __shinslot_orders?: OrderRow[];
  __shinslot_bucket?: Map<string, { body: Uint8Array; contentType: string }>;
};

if (!globalState.__shinslot_tenants) {
  const initialCfg = getActiveConfig();
  globalState.__shinslot_tenants = new Map<string, TenantRow>();
  globalState.__shinslot_tenants.set(tenantSlug, {
    slug: tenantSlug,
    owner_id: 'demo-admin',
    draft: JSON.stringify(initialCfg),
    published: JSON.stringify(initialCfg),
    updated_at: new Date().toISOString(),
  });
}

if (!globalState.__shinslot_orders) {
  globalState.__shinslot_orders = [
    {
      id: 'ORD-7291',
      tenant_slug: tenantSlug,
      items_json: JSON.stringify([
        { productId: 'p_hoodie', name: 'Оверсайз худи Heavy Cotton (Графит)', price: 5400, quantity: 1 },
        { productId: 'p_cap', name: 'Бейсболка с объемной вышивкой', price: 1900, quantity: 1 },
      ]),
      total: 7300,
      customer_name: 'Дмитрий Соколов',
      customer_phone: '+7 (915) 334-55-66',
      customer_email: 'dmitry@mail.ru',
      delivery_type: 'delivery',
      delivery_address: 'Москва, ул. Тверская 12, кв. 45',
      payment_method: 'online',
      payment_status: 'paid',
      status: 'processing',
      comment: 'Доставить после 18:00, позвонить за час',
      created_at: new Date(Date.now() - 4200000).toISOString(),
    },
    {
      id: 'ORD-7292',
      tenant_slug: tenantSlug,
      items_json: JSON.stringify([
        { productId: 'p_tshirt', name: 'Базовая футболка Premium Fit (Молочный)', price: 2600, quantity: 2 },
      ]),
      total: 5200,
      customer_name: 'Екатерина Морозова',
      customer_phone: '+7 (926) 778-99-00',
      delivery_type: 'pickup',
      payment_method: 'cash',
      payment_status: 'pending',
      status: 'new',
      created_at: new Date(Date.now() - 1500000).toISOString(),
    },
  ];
}

if (!globalState.__shinslot_bookings) {
  // Prepopulate with a couple sample bookings for preview realism
  const now = new Date();
  const todayIso = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  globalState.__shinslot_bookings = [
    {
      id: 'demo-b1',
      tenant_slug: tenantSlug,
      service_id: 'season',
      service_name: 'Сезонная смена шин',
      wheel_size: 16,
      vehicle_type: 'car',
      add_ons: '[]',
      price: 2760,
      starts_at: todayIso(14, 0),
      ends_at: todayIso(15, 10),
      post: 1,
      name: 'Алексей Смирнов',
      phone: '+7 (916) 123-45-67',
      status: 'confirmed',
      cancel_token: 'demo-token-1',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'demo-b2',
      tenant_slug: tenantSlug,
      service_id: 'balance',
      service_name: 'Балансировка',
      wheel_size: 17,
      vehicle_type: 'suv',
      add_ons: '[]',
      price: 2580,
      starts_at: todayIso(16, 30),
      ends_at: todayIso(17, 20),
      post: 2,
      name: 'Мария Иванова',
      phone: '+7 (926) 987-65-43',
      status: 'pending',
      cancel_token: 'demo-token-2',
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ];
}

if (!globalState.__shinslot_bucket) {
  globalState.__shinslot_bucket = new Map<string, { body: Uint8Array; contentType: string }>();
}

export const bucket = {
  async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const pool = getPostgresPool();
    if (pool) {
      await ensurePostgresSchema();
      await pool.query('INSERT INTO media_objects (object_key,body,content_type,updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (object_key) DO UPDATE SET body=EXCLUDED.body,content_type=EXCLUDED.content_type,updated_at=EXCLUDED.updated_at', [key, Buffer.from(bytes), options?.httpMetadata?.contentType || 'image/jpeg', new Date().toISOString()]);
      return;
    }
    globalState.__shinslot_bucket!.set(key, {
      body: bytes,
      contentType: options?.httpMetadata?.contentType || 'image/jpeg',
    });
  },
  async get(key: string) {
    const pool = getPostgresPool();
    if (pool) {
      await ensurePostgresSchema();
      const result = await pool.query<{ body: Buffer; content_type: string }>('SELECT body,content_type FROM media_objects WHERE object_key=$1', [key]);
      const item = result.rows[0];
      if (!item) return null;
      return { body: new Uint8Array(item.body), httpMetadata: { contentType: item.content_type } };
    }
    const item = globalState.__shinslot_bucket!.get(key);
    if (!item) return null;
    return {
      body: item.body,
      httpMetadata: { contentType: item.contentType },
    };
  },
};

export function database() {
  const postgres = postgresDatabase();
  if (postgres) return postgres;
  const tenants = globalState.__shinslot_tenants!;
  const bookings = globalState.__shinslot_bookings!;

  return {
    prepare(sql: string) {
      let boundParams: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          const trimmed = sql.trim();

          // 1. SELECT * FROM tenants WHERE slug = ?
          if (/SELECT\s+\*\s+FROM\s+tenants\s+WHERE\s+slug\s*=\s*\?/i.test(trimmed)) {
            const [slug] = boundParams;
            const t = tenants.get(String(slug));
            return (t as unknown as T) || null;
          }

          // 2. INSERT INTO bookings ... RETURNING id,post
          if (/INSERT\s+INTO\s+bookings[\s\S]*RETURNING\s+id\s*,\s*post/i.test(trimmed)) {
            const [
              id,
              tSlug,
              serviceId,
              serviceName,
              wheelSize,
              vehicleType,
              addOns,
              price,
              startsAt,
              endsAt,
              name,
              phone,
              status,
              cancelToken,
              createdAt,
              maxPosts,
              ,
              checkEnd,
              checkStart,
            ] = boundParams;

            const postsLimit = Number(maxPosts) || 2;
            const startMs = new Date(String(checkStart || startsAt)).getTime();
            const endMs = new Date(String(checkEnd || endsAt)).getTime();

            // Find lowest available post
            let allocatedPost: number | null = null;
            for (let p = 1; p <= postsLimit; p++) {
              const hasCollision = bookings.some((b) => {
                if (b.tenant_slug !== tSlug || b.post !== p || b.status === 'cancelled') return false;
                const bStartMs = new Date(b.starts_at).getTime();
                const bEndMs = new Date(b.ends_at).getTime();
                return bStartMs < endMs && bEndMs > startMs;
              });
              if (!hasCollision) {
                allocatedPost = p;
                break;
              }
            }

            if (allocatedPost === null) {
              return null;
            }

            const newBooking: BookingRow = {
              id: String(id),
              tenant_slug: String(tSlug),
              service_id: String(serviceId),
              service_name: String(serviceName),
              wheel_size: Number(wheelSize),
              vehicle_type: String(vehicleType),
              add_ons: String(addOns),
              price: Number(price),
              starts_at: String(startsAt),
              ends_at: String(endsAt),
              post: allocatedPost,
              name: String(name),
              phone: String(phone),
              status: String(status),
              cancel_token: String(cancelToken),
              created_at: String(createdAt),
            };

            bookings.unshift(newBooking);
            return { id, post: allocatedPost } as unknown as T;
          }

          // 3. SELECT ... FROM bookings WHERE id=? AND tenant_slug=? AND cancel_token=?
          if (/SELECT\s+.*FROM\s+bookings\s+WHERE\s+id\s*=\s*\?\s+AND\s+tenant_slug\s*=\s*\?\s+AND\s+cancel_token\s*=\s*\?/i.test(trimmed)) {
            const [id, tSlug, token] = boundParams;
            const b = bookings.find((x) => x.id === id && x.tenant_slug === tSlug && x.cancel_token === token);
            if (!b) return null;
            return {
              id: b.id,
              serviceName: b.service_name,
              wheelSize: b.wheel_size,
              startsAt: b.starts_at,
              status: b.status,
            } as unknown as T;
          }

          return null;
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          const trimmed = sql.trim();

          // 1. SELECT ... FROM bookings WHERE tenant_slug=? ORDER BY starts_at DESC LIMIT 300
          if (/SELECT\s+.*FROM\s+bookings\s+WHERE\s+tenant_slug\s*=\s*\?/i.test(trimmed)) {
            const [tSlug] = boundParams;
            const filtered = bookings
              .filter((b) => b.tenant_slug === tSlug)
              .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
              .slice(0, 300)
              .map((b) => ({
                id: b.id,
                serviceId: b.service_id,
                serviceName: b.service_name,
                wheelSize: b.wheel_size,
                vehicleType: b.vehicle_type,
                addOns: b.add_ons,
                price: b.price,
                startsAt: b.starts_at,
                endsAt: b.ends_at,
                post: b.post,
                name: b.name,
                phone: b.phone,
                status: b.status,
                createdAt: b.created_at,
              }));
            return { results: filtered as unknown as T[] };
          }

          // 2. SELECT starts_at,ends_at,post FROM bookings WHERE tenant_slug=? AND starts_at >= ? AND starts_at < ? AND status != ?
          if (/SELECT\s+starts_at\s*,\s*ends_at\s*,\s*post\s+FROM\s+bookings\s+WHERE\s+tenant_slug\s*=\s*\?/i.test(trimmed)) {
            const [tSlug, minStart, maxStart, excludedStatus] = boundParams;
            const minStartStr = String(minStart);
            const maxStartStr = String(maxStart);
            const excludedStatusStr = String(excludedStatus);
            const filtered = bookings
              .filter(
                (b) =>
                  b.tenant_slug === tSlug &&
                  b.starts_at >= minStartStr &&
                  b.starts_at < maxStartStr &&
                  b.status !== excludedStatusStr
              )
              .map((b) => ({
                starts_at: b.starts_at,
                ends_at: b.ends_at,
                post: b.post,
              }));
            return { results: filtered as unknown as T[] };
          }

          return { results: [] };
        },
        async run(): Promise<{ meta: { changes: number } }> {
          const trimmed = sql.trim();

          // 1. INSERT INTO tenants ... ON CONFLICT(slug) DO UPDATE ...
          if (/INSERT\s+INTO\s+tenants/i.test(trimmed)) {
            const [slug, ownerId, draft, published, updatedAt] = boundParams;
            tenants.set(String(slug), {
              slug: String(slug),
              owner_id: ownerId ? String(ownerId) : null,
              draft: String(draft),
              published: String(published),
              updated_at: String(updatedAt),
            });
            return { meta: { changes: 1 } };
          }

          // 2. UPDATE bookings SET status=? WHERE id=? AND tenant_slug=?
          if (/UPDATE\s+bookings\s+SET\s+status\s*=\s*\?\s+WHERE\s+id\s*=\s*\?\s+AND\s+tenant_slug\s*=\s*\?(?!\s+AND)/i.test(trimmed)) {
            const [status, id, tSlug] = boundParams;
            const b = bookings.find((x) => x.id === id && x.tenant_slug === tSlug);
            if (b) {
              b.status = String(status);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // 3. UPDATE bookings SET status=? WHERE id=? AND tenant_slug=? AND cancel_token=?
          if (/UPDATE\s+bookings\s+SET\s+status\s*=\s*\?\s+WHERE\s+id\s*=\s*\?\s+AND\s+tenant_slug\s*=\s*\?/i.test(trimmed)) {
            const [status, id, tSlug, cancelToken] = boundParams;
            const b = bookings.find((x) => x.id === id && x.tenant_slug === tSlug && x.cancel_token === cancelToken);
            if (b) {
              b.status = String(status);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };
}

export async function tenant() {
  const row = await database()
    .prepare('SELECT * FROM tenants WHERE slug = ?')
    .bind(tenantSlug)
    .first<TenantRow>();
  if (!row && getPostgresPool()) {
    const initial = getActiveConfig();
    await ensurePostgresSchema();
    await database().prepare('INSERT INTO tenants (slug,owner_id,draft,published,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO NOTHING')
      .bind(tenantSlug, 'demo-admin', JSON.stringify(initial), JSON.stringify(initial), new Date().toISOString()).run();
    return database().prepare('SELECT * FROM tenants WHERE slug = ?').bind(tenantSlug).first<TenantRow>();
  }
  return row;
}

/** A metadata-only view for platform operators; never includes customer records or secrets. */
export async function platformOverview() {
  const pool = getPostgresPool();
  let tenants: TenantRow[];
  let bookingCounts = new Map<string, number>();
  let orderCounts = new Map<string, number>();
  let storage = 'in-memory-demo';
  if (pool) {
    await ensurePostgresSchema();
    const [tenantResult, bookingResult, orderResult] = await Promise.all([
      pool.query<TenantRow>('SELECT * FROM tenants ORDER BY slug'),
      pool.query<{ tenant_slug: string; count: string }>('SELECT tenant_slug,COUNT(*)::text AS count FROM bookings GROUP BY tenant_slug'),
      pool.query<{ tenant_slug: string; count: string }>('SELECT tenant_slug,COUNT(*)::text AS count FROM orders GROUP BY tenant_slug'),
    ]);
    tenants = tenantResult.rows;
    bookingCounts = new Map(bookingResult.rows.map((row) => [row.tenant_slug, Number(row.count)]));
    orderCounts = new Map(orderResult.rows.map((row) => [row.tenant_slug, Number(row.count)]));
    storage = 'postgresql';
  } else {
    tenants = [...globalState.__shinslot_tenants!.values()];
    for (const booking of globalState.__shinslot_bookings!) bookingCounts.set(booking.tenant_slug, (bookingCounts.get(booking.tenant_slug) || 0) + 1);
    for (const order of globalState.__shinslot_orders!) orderCounts.set(order.tenant_slug, (orderCounts.get(order.tenant_slug) || 0) + 1);
  }
  const companies = tenants.map((row) => {
    let published: Config = getActiveConfig();
    try { published = { ...published, ...JSON.parse(row.published) as Partial<Config> }; } catch { /* report incomplete config below */ }
    const draft = (() => { try { return JSON.parse(row.draft) as Partial<Config>; } catch { return null; } })();
    const complete = Boolean(published.name && published.phone && published.email && (published.products?.length || published.services?.length));
    return {
      slug: row.slug,
      ownerId: row.owner_id,
      name: published.name || row.slug,
      email: published.email || null,
      phone: published.phone || null,
      siteMode: published.siteMode,
      updatedAt: row.updated_at,
      hasDraftChanges: Boolean(draft && JSON.stringify(draft) !== row.published),
      configurationComplete: complete,
      bookings: bookingCounts.get(row.slug) || 0,
      orders: orderCounts.get(row.slug) || 0,
    };
  });
  return {
    storage,
    uptimeSeconds: Math.floor(process.uptime()),
    companies,
    totals: {
      companies: companies.length,
      bookings: [...bookingCounts.values()].reduce((sum, count) => sum + count, 0),
      orders: [...orderCounts.values()].reduce((sum, count) => sum + count, 0),
    },
  };
}

export async function config(published = true): Promise<Config> {
  const row = await tenant();
  const base = getActiveConfig();
  if (!row) return base;
  try {
    const parsed = JSON.parse(published ? row.published : row.draft) as Config;
    if (parsed && typeof parsed === 'object') {
      return { ...base, ...parsed, deliveryPricing: parsed.deliveryPricing || { ...DEFAULT_DELIVERY_PRICING, freeAtSubtotal: parsed.freeDeliveryThreshold ?? DEFAULT_DELIVERY_PRICING.freeAtSubtotal } };
    }
    return base;
  } catch {
    return base;
  }
}

export function signedIn(request?: Request) {
  if (!request) return null;
  const headerId = request.headers.get('oai-authenticated-user-id');
  if (process.env.TRUST_PLATFORM_AUTH_HEADER === 'true' && headerId) return headerId;
  return isTrustedAdmin(request) ? 'admin-session' : null;
}

export async function admin(request?: Request) {
  return signedIn(request);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

export function localIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}

export function timeMinutes(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function minutesTime(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export async function getOrders(): Promise<OrderRow[]> {
  const pool = getPostgresPool();
  if (pool) {
    await ensurePostgresSchema();
    const result = await pool.query<OrderRow>('SELECT * FROM orders WHERE tenant_slug=$1 ORDER BY created_at DESC LIMIT 1000', [tenantSlug]);
    return result.rows;
  }
  const list = globalState.__shinslot_orders || [];
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createOrder(data: {
  items: unknown[];
  subtotal: number;
  discount: number;
  deliveryCost: number;
  total: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  customerAccessToken: string;
  paymentMethod: 'online' | 'cash' | 'transfer';
  paymentStatus?: 'paid' | 'pending';
  comment?: string;
}): Promise<OrderRow> {
  if (!globalState.__shinslot_orders) {
    globalState.__shinslot_orders = [];
  }
  const id = 'ORD-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const row: OrderRow = {
    id,
    tenant_slug: tenantSlug,
    items_json: JSON.stringify(data.items || []),
    total: Number(data.total) || 0,
    customer_name: String(data.customerName || '').trim(),
    customer_phone: String(data.customerPhone || '').trim(),
    customer_email: data.customerEmail ? String(data.customerEmail).trim() : undefined,
    delivery_type: data.deliveryType === 'delivery' ? 'delivery' : 'pickup',
    delivery_address: data.deliveryAddress ? String(data.deliveryAddress).trim() : undefined,
    delivery_latitude: data.deliveryLatitude,
    delivery_longitude: data.deliveryLongitude,
    subtotal: data.subtotal,
    discount: data.discount,
    delivery_cost: data.deliveryCost,
    customer_access_token: data.customerAccessToken,
    payment_method: data.paymentMethod || 'cash',
    payment_status: 'pending',
    status: 'new',
    comment: data.comment ? String(data.comment).trim() : undefined,
    created_at: new Date().toISOString(),
  };

  const pool = getPostgresPool();
  if (pool) {
    await ensurePostgresSchema();
    await pool.query(
      'INSERT INTO orders (id,tenant_slug,items_json,total,customer_name,customer_phone,customer_email,delivery_type,delivery_address,delivery_latitude,delivery_longitude,subtotal,discount,delivery_cost,customer_access_token,payment_method,payment_status,status,comment,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)',
      [row.id,row.tenant_slug,row.items_json,row.total,row.customer_name,row.customer_phone,row.customer_email,row.delivery_type,row.delivery_address,row.delivery_latitude,row.delivery_longitude,row.subtotal,row.discount,row.delivery_cost,row.customer_access_token,row.payment_method,row.payment_status,row.status,row.comment,row.created_at],
    );
    return row;
  }
  globalState.__shinslot_orders.unshift(row);
  return row;
}

export async function updateOrderStatus(id: string, status: string, paymentStatus?: string, rejectionReason?: string): Promise<boolean> {
  const pool = getPostgresPool();
  if (pool) {
    await ensurePostgresSchema();
    const result = await pool.query(
      `UPDATE orders SET status=$1,payment_status=COALESCE($2,payment_status),
       rejection_reason=CASE WHEN $1='cancelled' THEN NULLIF(LEFT(COALESCE($3,''),500),'') ELSE rejection_reason END
       WHERE id=$4 AND tenant_slug=$5`,
      [status, paymentStatus || null, rejectionReason?.trim() || null, id, tenantSlug],
    );
    return (result.rowCount || 0) > 0;
  }
  const list = globalState.__shinslot_orders || [];
  const order = list.find((o) => o.id === id);
  if (!order) return false;
  if (status) order.status = status as OrderRow['status'];
  if (paymentStatus) order.payment_status = paymentStatus as OrderRow['payment_status'];
  if (status === 'cancelled') order.rejection_reason = rejectionReason?.trim().slice(0, 500) || undefined;
  return true;
}
