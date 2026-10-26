import { NextRequest, NextResponse } from 'next/server';
import { getOrders, createOrder, admin, json, config } from '@/lib/server';
import { readJson, JsonRequestError } from '@/lib/read-json';
import { sendAdminTelegramAlert } from '@/lib/notifications';

export async function GET(request: Request) {
  if (!await admin(request)) return json({ error: 'Нет доступа' }, 403);
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
        deliveryLatitude: o.delivery_latitude,
        deliveryLongitude: o.delivery_longitude,
        subtotal: o.subtotal,
        discount: o.discount,
        deliveryCost: o.delivery_cost,
        rejectionReason: o.rejection_reason,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        status: o.status,
        comment: o.comment,
        createdAt: o.created_at,
      };
    });
    return NextResponse.json({ orders: formatted }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки заказов' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<Record<string, any>>(req, 64 * 1024);
    const { calculateOrder, normalizeRussianPhone } = await import('@/lib/commerce');
    const c = await config();
    const name = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = normalizeRussianPhone(typeof body.customerPhone === 'string' ? body.customerPhone : '');
    if (name.length < 2 || name.length > 100 || !/^[\p{L} -]+$/u.test(name) || !phone || !Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json(
        { error: !phone ? 'Укажите российский номер телефона из 10 или 11 цифр' : 'Проверьте имя и состав заказа' },
        { status: 400 }
      );
    }
    if (body.customerEmail !== undefined && (typeof body.customerEmail !== 'string' || body.customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail))) return NextResponse.json({ error: 'Проверьте адрес электронной почты' }, { status: 400 });

    const deliveryType = body.deliveryType === 'delivery' ? 'delivery' : body.deliveryType === 'pickup' ? 'pickup' : null;
    if (!deliveryType || (deliveryType === 'delivery' && (typeof body.deliveryAddress !== 'string' || !body.deliveryAddress.trim() || body.deliveryAddress.length > 400))) {
      return NextResponse.json({ error: 'Проверьте способ и адрес доставки' }, { status: 400 });
    }
    if (!['cash', 'transfer'].includes(body.paymentMethod)) return NextResponse.json({ error: body.paymentMethod === 'online' ? 'Онлайн-эквайринг не подключён' : 'Недопустимый способ оплаты' }, { status: 400 });
    if (body.paymentMethod === 'cash' && !c.paymentMethods?.cashOnDelivery || body.paymentMethod === 'transfer' && !c.paymentMethods?.cardTransfer) return NextResponse.json({ error: 'Этот способ оплаты сейчас недоступен' }, { status: 400 });
    if (body.deliveryLatitude !== undefined && (!Number.isFinite(body.deliveryLatitude) || Math.abs(body.deliveryLatitude) > 90)) return NextResponse.json({ error: 'Неверные координаты доставки' }, { status: 400 });
    if (body.deliveryLongitude !== undefined && (!Number.isFinite(body.deliveryLongitude) || Math.abs(body.deliveryLongitude) > 180)) return NextResponse.json({ error: 'Неверные координаты доставки' }, { status: 400 });
    if ((body.deliveryLatitude === undefined) !== (body.deliveryLongitude === undefined)) return NextResponse.json({ error: 'Передайте обе координаты доставки' }, { status: 400 });
    const quote = calculateOrder(c, body.items, typeof body.promoCode === 'string' ? body.promoCode : undefined, deliveryType);

    const customerAccessToken = crypto.randomUUID() + crypto.randomUUID();
    const order = await createOrder({
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      deliveryCost: quote.delivery,
      total: quote.total,
      customerName: name,
      customerPhone: phone,
      customerEmail: body.customerEmail,
      deliveryType,
      deliveryAddress: body.deliveryAddress,
      deliveryLatitude: body.deliveryLatitude,
      deliveryLongitude: body.deliveryLongitude,
      customerAccessToken,
      paymentMethod: body.paymentMethod,
      comment: typeof body.comment === 'string' ? body.comment.slice(0, 1000) : undefined,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        customerAccessToken: order.customer_access_token,
        status: order.status,
        paymentStatus: order.payment_status,
      },
    });
  } catch (error) {
    if (error instanceof JsonRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Не удалось создать заказ' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await admin(req)) return json({ error: 'Нет доступа' }, 403);
  let parsed: unknown;
  try { parsed = await readJson<unknown>(req, 8 * 1024); }
  catch (error) {
    if (error instanceof JsonRequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Некорректный запрос заказа' }, 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Некорректный запрос заказа' }, 400);
  const body = parsed as Record<string, unknown>;
  const { id, status, paymentStatus, rejectionReason } = body;
  if (typeof id !== 'string' || !id.trim() || id.length > 100) return json({ error: 'ID заказа обязателен' }, 400);
  if (typeof status !== 'string' || !['new', 'processing', 'completed', 'cancelled'].includes(status)) return json({ error: 'Недопустимый статус' }, 400);
  if (paymentStatus !== undefined && paymentStatus !== 'paid' && paymentStatus !== 'pending') return json({ error: 'Недопустимый статус оплаты' }, 400);
  if (rejectionReason !== undefined && (typeof rejectionReason !== 'string' || rejectionReason.length > 500)) return json({ error: 'Некорректная причина отказа' }, 400);
  try {
    const { updateOrderStatus } = await import('@/lib/server');
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
    return NextResponse.json({ error: 'Не удалось обновить заказ' }, { status: 500 });
  }
}
