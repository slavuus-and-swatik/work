import { admin, config, database, json, tenant, tenantSlug } from '@/lib/server';
import { defaultConfig, type Config } from '@/lib/shinslot';

export async function GET(request: Request) {
  const draft = new URL(request.url).searchParams.get('draft') === '1';
  if (draft && !(await admin(request))) return json({ error: 'Требуется вход в админку' }, 403);
  const isAdmin = Boolean(await admin(request));
  const current = await config(!draft);
  const publishedConfig = draft ? await config(true) : current;
  const safeConfig = isAdmin ? current : {
    ...current,
    paymentMethods: { ...current.paymentMethods, yookassaSecretKey: undefined, tbankTerminalKey: undefined },
  };
  return json({ config: safeConfig, isAdmin, activePresetKey: publishedConfig.niche });
}

export async function PUT(request: Request) {
  const id = await admin(request);
  if (!id) return json({ error: 'Требуется вход в админку' }, 403);
  const body = (await request.json()) as { config?: Config; publish?: boolean };
  const c = body.config;
  if (!c || typeof c.name !== 'string' || c.name.length > 120 || !Array.isArray(c.services) || c.services.length > 300 || !Array.isArray(c.products) || c.products.length > 500 || !Number.isInteger(c.posts) || c.posts < 1 || c.posts > 20 || !Number.isFinite(c.deliveryCost) || c.deliveryCost < 0 || c.deliveryCost > 1_000_000) {
    return json({ error: 'Проверьте настройки' }, 400);
  }
  const productIds = new Set<string>();
  const validTextList = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every((line) => typeof line === 'string' && line.trim().length > 0 && line.length <= 500);
  for (const product of c.products) {
    if (!product || typeof product.id !== 'string' || !/^[\w-]{1,80}$/.test(product.id) || productIds.has(product.id) || typeof product.name !== 'string' || product.name.trim().length < 1 || product.name.length > 180 || typeof product.description !== 'string' || product.description.length > 10000 || !Number.isFinite(product.price) || product.price < 0 || product.price > 1_000_000_000 || typeof product.enabled !== 'boolean' || typeof product.inStock !== 'boolean' || !Array.isArray(product.galleryImages || []) || (product.galleryImages || []).length > 12 || !Array.isArray(product.attributes || []) || (product.attributes || []).length > 100 || (product.productType !== undefined && (typeof product.productType !== 'string' || product.productType.length > 80)) || (product.stockQuantity !== undefined && (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < 0 || product.stockQuantity > 1_000_000)) || (product.popularity !== undefined && (!Number.isFinite(product.popularity) || product.popularity < 0 || product.popularity > 1_000_000_000)) || (product.createdAt !== undefined && (typeof product.createdAt !== 'string' || product.createdAt.length > 40 || Number.isNaN(Date.parse(product.createdAt)))) || (product.details !== undefined && (!product.details || !validTextList(product.details.advantages || []) || !validTextList(product.details.included || []) || ['warranty', 'delivery', 'returns'].some((key) => product.details?.[key as 'warranty' | 'delivery' | 'returns'] !== undefined && (typeof product.details[key as 'warranty' | 'delivery' | 'returns'] !== 'string' || product.details[key as 'warranty' | 'delivery' | 'returns']!.length > 500)))) || (product.shippingClass !== undefined && !['standard', 'bulky', 'fragile'].includes(product.shippingClass))) {
      return json({ error: 'Проверьте название, цену и характеристики товаров' }, 400);
    }
    productIds.add(product.id);
    if (![product.imageUrl, ...(product.galleryImages || [])].every((url) => typeof url === 'string' && (url.startsWith('/') || /^https:\/\//i.test(url)))) return json({ error: 'Фотографии должны использовать HTTPS или локальный путь' }, 400);
    if ((product.attributes || []).some((item) => !item || typeof item.label !== 'string' || item.label.length > 120 || typeof item.value !== 'string' || item.value.length > 1000)) return json({ error: 'Проверьте характеристики товаров' }, 400);
    if (product.weightKg !== undefined && (!Number.isFinite(product.weightKg) || product.weightKg < 0 || product.weightKg > 1000)) return json({ error: 'Проверьте вес товаров' }, 400);
  }
  if (c.promoCode && (typeof c.promoCode.code !== 'string' || c.promoCode.code.length > 80 || !Number.isFinite(c.promoCode.discountPercent) || c.promoCode.discountPercent < 1 || c.promoCode.discountPercent > 100)) return json({ error: 'Проверьте настройки промокода' }, 400);
  if (c.deliveryPricing) {
    const p = c.deliveryPricing;
    const validTiers = (tiers: unknown) => Array.isArray(tiers) && tiers.length <= 20 && tiers.every((tier) => tier && Number.isFinite(tier.from) && tier.from > 0 && Number.isFinite(tier.amount) && tier.amount >= 0 && tier.amount <= 1_000_000);
    if (!Number.isFinite(p.freeAtSubtotal) || p.freeAtSubtotal < 0 || p.freeAtSubtotal > 1_000_000_000 || !validTiers(p.countDiscounts) || !validTiers(p.subtotalDiscounts) || !Number.isFinite(p.weightRatePerKg) || p.weightRatePerKg < 0 || p.weightRatePerKg > 1_000_000 || Object.values(p.classSurcharges || {}).some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 1_000_000)) return json({ error: 'Проверьте параметры расчёта доставки' }, 400);
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
