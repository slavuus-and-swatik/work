import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus, admin, getOrders, json } from '@/lib/server';
import { sendAdminTelegramAlert } from '@/lib/notifications';
import { readJson, JsonRequestError } from '@/lib/read-json';


export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get('token') || '';
  const order = (await getOrders()).find((item) => item.id === id);
  if (!order || !token || token !== order.customer_access_token) return json({ error: 'Заказ не найден' }, 404);
  return json({ order: { id: order.id, status: order.status, rejectionReason: order.rejection_reason, total: order.total, createdAt: order.created_at } });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!await admin(req)) return json({ error: 'Нет доступа' }, 403);
  let parsed: unknown;
  try { parsed = await readJson<unknown>(req, 8 * 1024); }
  catch (error) {
    if (error instanceof JsonRequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Некорректный запрос заказа' }, 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Некорректный запрос заказа' }, 400);
  const body = parsed as Record<string, unknown>;
  const { id } = await context.params;
  const { status, paymentStatus, rejectionReason } = body;
  if (!id || id.length > 100) return json({ error: 'Неверный ID заказа' }, 400);
  if (typeof status !== 'string' || !['new', 'processing', 'completed', 'cancelled'].includes(status)) return json({ error: 'Недопустимый статус' }, 400);
  if (paymentStatus !== undefined && paymentStatus !== 'paid' && paymentStatus !== 'pending') return json({ error: 'Недопустимый статус оплаты' }, 400);
  if (rejectionReason !== undefined && (typeof rejectionReason !== 'string' || rejectionReason.length > 500)) return json({ error: 'Некорректная причина отказа' }, 400);
  try {
    const ok = await updateOrderStatus(id, status, paymentStatus as string | undefined, rejectionReason as string | undefined);
    if (!ok) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    if (status === 'cancelled') {
      try {
        const reason = typeof rejectionReason === 'string' && rejectionReason.trim() ? rejectionReason.trim() : 'не указана';
        await sendAdminTelegramAlert('Заказ #' + id + ' отклонён.\nПричина: ' + reason + '\nВремя: ' + new Date().toISOString());
      } catch {
        console.warn('[admin-notifications] Failed to send order rejection alert');
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления статуса заказа' }, { status: 500 });
  }
}
