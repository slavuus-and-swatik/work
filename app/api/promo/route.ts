import { calculateOrder } from '@/lib/commerce';
import { config, json } from '@/lib/server';
import { readJson, JsonRequestError } from '@/lib/read-json';

export async function POST(request: Request) {
  try {
    const body = await readJson<{ items?: unknown; promoCode?: unknown; deliveryType?: unknown }>(request, 32 * 1024);
    if (typeof body.promoCode !== 'string' || !Array.isArray(body.items)) return json({ error: 'Введите промокод' }, 400);
    const quote = calculateOrder(await config(), body.items as Array<{ productId: string; quantity: number }>, body.promoCode, body.deliveryType === 'delivery' ? 'delivery' : 'pickup');
    return json({ valid: true, ...quote });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Такого промокода нет' }, error instanceof JsonRequestError ? error.status : 400);
  }
}
