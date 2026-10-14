import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/server';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status, paymentStatus } = body;
    const ok = await updateOrderStatus(id, status, paymentStatus);
    if (!ok) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления статуса заказа' }, { status: 500 });
  }
}
