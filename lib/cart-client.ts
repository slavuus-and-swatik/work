import type { Product } from '@/lib/shinslot';

export type StoredCartLine = { product: Product; quantity: number };

export const CART_STORAGE_KEY = 'shinslot-cart-items';
export const CART_UPDATED_EVENT = 'shinslot-cart-updated';

export function readStoredCart(): StoredCartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((line): line is StoredCartLine => Boolean(
      line && typeof line === 'object' && 'product' in line && 'quantity' in line &&
      (line as StoredCartLine).product?.id && Number.isSafeInteger((line as StoredCartLine).quantity) &&
      (line as StoredCartLine).quantity > 0,
    ));
  } catch {
    return [];
  }
}

export function writeStoredCart(cart: StoredCartLine[]) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(cart);
    if (window.localStorage.getItem(CART_STORAGE_KEY) === serialized) return;
    window.localStorage.setItem(CART_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  } catch {
    // Private browsing and quota restrictions can disable localStorage.
  }
}
