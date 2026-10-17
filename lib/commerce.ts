import { DEFAULT_DELIVERY_PRICING, type Config, type Product } from '@/lib/shinslot';

export type CartLineInput = { productId: string; quantity: number };

export function normalizeRussianPhone(value: string): string | null {
  if (!/^\+?[\d\s()-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length !== 11 || !digits.startsWith('7')) return null;
  return `+${digits}`;
}

function highestDiscount(tiers: Array<{ from: number; amount: number }> | undefined, value: number) {
  return (tiers || []).reduce((best, tier) => value >= tier.from ? Math.max(best, tier.amount) : best, 0);
}

export function calculateOrder(config: Config, lines: CartLineInput[], promoCode?: string, deliveryType: 'pickup' | 'delivery' = 'pickup') {
  const products = new Map((config.products || []).filter((p) => p.enabled && p.inStock).map((p) => [p.id, p]));
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error('Корзина пуста или слишком большая');
  const aggregated = new Map<string, number>();
  for (const line of lines) {
    if (!line || typeof line.productId !== 'string' || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new Error('Проверьте количество товаров в корзине');
    }
    aggregated.set(line.productId, (aggregated.get(line.productId) || 0) + line.quantity);
  }
  if ([...aggregated.values()].some((quantity) => quantity > 99)) throw new Error('Максимум 99 штук одного товара');

  const items = [...aggregated].map(([id, quantity]) => {
    const product = products.get(id);
    if (!product) throw new Error('Один из товаров больше недоступен');
    if (product.stockQuantity !== undefined && (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < 0 || quantity > product.stockQuantity)) throw new Error(`Недостаточно товара «${product.name}» на складе`);
    return { product, quantity };
  });
  const subtotal = items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  const promo = config.promoCode;
  let discount = 0;
  if (promoCode?.trim()) {
    if (!promo || promo.code.trim().toUpperCase() !== promoCode.trim().toUpperCase() || !Number.isFinite(promo.discountPercent) || promo.discountPercent <= 0 || promo.discountPercent > 100) {
      throw new Error('Такого промокода нет');
    }
    discount = Math.round(subtotal * promo.discountPercent / 100);
  }

  const pricing = config.deliveryPricing || { ...DEFAULT_DELIVERY_PRICING, freeAtSubtotal: config.freeDeliveryThreshold ?? DEFAULT_DELIVERY_PRICING.freeAtSubtotal };
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shippingBase = items.reduce((sum, { product, quantity }) => {
    const kind = product.shippingClass || 'standard';
    const surcharge = pricing?.classSurcharges?.[kind] || 0;
    return sum + quantity * (surcharge + Math.max(0, product.weightKg || 0) * (pricing?.weightRatePerKg || 0));
  }, 0);
  let delivery = 0;
  if (deliveryType === 'delivery') {
    const freeAt = pricing.freeAtSubtotal ?? config.freeDeliveryThreshold ?? Number.POSITIVE_INFINITY;
    if (subtotal < freeAt) {
      const qtyDiscount = highestDiscount(pricing.countDiscounts, itemCount);
      const sumDiscount = highestDiscount(pricing.subtotalDiscounts, subtotal);
      delivery = Math.max(0, (config.deliveryCost || 350) + shippingBase - qtyDiscount - sumDiscount);
    }
  }
  return {
    items: items.map(({ product, quantity }) => ({ productId: product.id, name: product.name, price: product.price, quantity, imageUrl: product.imageUrl })),
    subtotal,
    discount,
    delivery,
    total: Math.max(0, subtotal - discount + delivery),
  };
}

export function calculateDeliveryForProduct(config: Config, product: Product, quantity = 1) {
  return calculateOrder(config, [{ productId: product.id, quantity }], undefined, 'delivery').delivery;
}
