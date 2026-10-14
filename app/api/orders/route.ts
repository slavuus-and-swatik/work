import { NextRequest, NextResponse } from 'next/server';
import { getOrders, createOrder } from '@/lib/server';

export async function GET() {
  try {
    const list = await getOrders();
    const formatted = list.map((o) => {
      let items = [];
      try {
        items = JSON.parse(o.items_json);
      } catch {}
      return {
        id: o.id,
        items,
        total: o.total,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        customerEmail: o.customer_email,
        deliveryType: o.delivery_type,
        deliveryAddress: o.delivery_address,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        status: o.status,
        comment: o.comment,
        createdAt: o.created_at,
      };
    });
    return NextResponse.json({ orders: formatted });
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки заказов' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.customerName || !body.customerPhone || !Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json(
        { error: 'Укажите имя, телефон и выберите хотя бы один товар' },
        { status: 400 }
      );
    }

    const order = await createOrder({
      items: body.items,
      total: body.total,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryType: body.deliveryType,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      comment: body.comment,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Не удалось создать заказ' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, paymentStatus } = body;
    if (!id) {
      return NextResponse.json({ error: 'ID заказа обязателен' }, { status: 400 });
    }
    const { updateOrderStatus } = await import('@/lib/server');
    const ok = await updateOrderStatus(id, status, paymentStatus);
    if (!ok) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Не удалось обновить заказ' }, { status: 500 });
  }
}
