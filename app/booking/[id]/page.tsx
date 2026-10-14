'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';

type BookingReminder = {
  serviceName: string;
  wheelSize?: number;
  startsAt: string;
  status: string;
};

export default function ManageBooking() {
  const params = useParams<{ id: string }>();
  const query = useSearchParams();
  const [details, setDetails] = useState<BookingReminder | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = query.get('token');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/bookings/${params.id}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setDetails((d as { booking: BookingReminder }).booking))
      .catch(() => setError('Не удалось загрузить запись. Проверьте ссылку.'));
  }, [params.id, token]);

  async function cancel() {
    setBusy(true);
    const r = await fetch(`/api/bookings/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancelToken: token }),
    });
    const d = (await r.json()) as { error?: string };
    if (r.ok) {
      setDone(true);
      setDetails((v) => (v ? { ...v, status: 'cancelled' } : v));
      localStorage.removeItem('shinslot-my-booking');
    } else {
      setError(d.error || 'Не удалось отменить запись');
    }
    setBusy(false);
  }

  return (
    <main className="manage-page">
      <div className="manage-card">
        <Link className="logo" href="/">
          <span className="logo-mark">
            <Sparkles size={20} />
          </span>
          Онлайн-запись
        </Link>
        {done || details?.status === 'cancelled' ? (
          <>
            <span className="manage-check">
              <Check />
            </span>
            <h1>Запись отменена</h1>
            <p>Время снова доступно для других клиентов.</p>
          </>
        ) : (
          <>
            <h1>Ваша запись</h1>
            {details && (
              <div className="manage-reminder">
                <strong>
                  {details.status === 'confirmed' ? 'Вы записаны' : 'Вы оставили заявку'} на{' '}
                  {new Date(details.startsAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Europe/Moscow',
                  })}{' '}
                  в{' '}
                  {new Date(details.startsAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow',
                  })}
                </strong>
                <span>
                  Услуга: {details.serviceName}
                  {details.wheelSize ? ` · R${details.wheelSize}` : ''}
                </span>
                {details.status === 'pending' && <small>Ожидает подтверждения владельца</small>}
              </div>
            )}
            <p>Если ваши планы изменились, вы можете отменить запись в один клик.</p>
            {error && <p className="error">{error}</p>}
            <button className="btn" disabled={busy || !token} onClick={cancel}>
              {busy ? 'Отменяем...' : 'Отменить запись'}
            </button>
          </>
        )}
        <Link href="/">
          <ArrowLeft size={16} /> Вернуться на сайт
        </Link>
      </div>
    </main>
  );
}
