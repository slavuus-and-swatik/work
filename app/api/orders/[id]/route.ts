import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus, admin, getOrders, json } from '@/lib/server';
import { sendAdminTelegramAlert } from '@/lib/notifications';

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
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status, paymentStatus, rejectionReason } = body;
    if (!['new', 'processing', 'completed', 'cancelled'].includes(status)) return json({ error: 'Недопустимый статус' }, 400);
    const ok = await updateOrderStatus(id, status, paymentStatus, rejectionReason);
    if (!ok) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }
    if (status === 'cancelled') {
      try {
        await sendAdminTelegramAlert('\u0417\u0430\u043a\u0430\u0437 #' + id + ' \u043e\u0442\u043a\u043b\u043e\u043d\u0451\u043d.\n\u041f\u0440\u0438\u0447\u0438\u043d\u0430: ' + (typeof rejectionReason === 'string' && rejectionReason.trim() ? rejectionReason.trim().slice(0, 500) : '\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430') + '\n\u0412\u0440\u0435\u043c\u044f: ' + new Date().toISOString());
      } catch {
        console.warn('[admin-notifications] Failed to send order rejection alert');
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления статуса заказа' }, { status: 500 });
  }
}
