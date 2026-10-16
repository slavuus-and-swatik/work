'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type OrderView = { id: string; status: 'new' | 'processing' | 'completed' | 'cancelled'; rejectionReason?: string; total: number; createdAt: string };
const labels: Record<OrderView['status'], string> = { new: 'Заказ получен', processing: 'Заказ обрабатывается', completed: 'Заказ выполнен', cancelled: 'Заказ отклонён' };

export default function OrderStatus({ orderId, token }: { orderId: string; token: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState('Загружаем статус…');
  useEffect(() => {
    if (!token || !orderId) { setError('Ссылка для отслеживания заказа неполная.'); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await response.json() as { order?: OrderView; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || 'Заказ не найден');
        if (active) { setOrder(data.order); setError(''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Не удалось проверить статус заказа'); }
    };
    void load();
    const interval = window.setInterval(load, 20_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [orderId, token]);
  return <main className="site order-status-page"><Link href="/">← На главную</Link><section><h1>Заказ #{orderId}</h1>{order ? <><strong className={order.status === 'cancelled' ? 'order-rejected' : ''}>{labels[order.status]}</strong><p>Сумма заказа: {new Intl.NumberFormat('ru-RU').format(order.total)} ₽</p>{order.status === 'cancelled' && <div className="order-rejection-reason"><b>Причина отказа:</b><p>{order.rejectionReason || 'Магазин не указал причину.'}</p></div>}<small>Статус обновляется автоматически каждые 20 секунд.</small></> : <p role="status">{error}</p>}</section></main>;
}
