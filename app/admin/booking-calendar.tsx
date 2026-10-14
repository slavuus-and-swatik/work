'use client';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import type { Booking, Config } from '@/lib/shinslot';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDate = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
const localTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export default function BookingCalendar({
  bookings,
  config,
  onCreated,
}: {
  bookings: Booking[];
  config: Config;
  onCreated: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [manual, setManual] = useState(false);
  const [serviceId, setServiceId] = useState(config.services[0]?.id || '');
  const [date, setDate] = useState(fmt(new Date()));
  const [time, setTime] = useState('09:00');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [offset]);

  async function add() {
    if (name.trim().length < 2) {
      setError('Укажите имя клиента (минимум 2 буквы)');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Укажите корректный номер телефона (минимум 10 цифр)');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: serviceId || config.services.find((s) => s.enabled)?.id || '',
          wheelSize: 16,
          vehicleType: 'car',
          runflat: false,
          date,
          time,
          name: name.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error || 'Ошибка записи');
      setManual(false);
      setName('');
      setPhone('');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка записи');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel calendar-panel">
      <div className="panel-head">
        <h2>Календарь записей</h2>
        <div className="calendar-controls">
          <button onClick={() => setOffset((x) => x - 1)} aria-label="Предыдущая неделя">
            <ArrowLeft size={15} />
          </button>
          <span suppressHydrationWarning>
            {days[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} —{' '}
            {days[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </span>
          <button onClick={() => setOffset((x) => x + 1)} aria-label="Следующая неделя">
            <ArrowRight size={15} />
          </button>
          <button className="calendar-add" onClick={() => setManual(true)}>
            <Plus size={15} /> Добавить запись
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {days.map((d) => {
          const key = fmt(d);
          const items = bookings
            .filter((b) => localDate(b.startsAt) === key && b.status !== 'cancelled')
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div className="calendar-day" key={key}>
              <div className="calendar-day-head">
                <span>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][(d.getDay() + 6) % 7]}</span>
                <strong>{d.getDate()}</strong>
              </div>
              <div className="calendar-events">
                {items.map((b) => (
                  <div className={`calendar-event ${b.status}`} key={b.id}>
                    <strong>{localTime(b.startsAt)}</strong>
                    <span>{b.name}</span>
                    <small>{b.serviceName}</small>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {manual && (
        <div className="manual-overlay">
          <div className="manual-card">
            <div className="panel-head">
              <h2>Запись по телефону</h2>
              <button onClick={() => setManual(false)} aria-label="Закрыть">
                <X size={17} />
              </button>
            </div>
            <p>
              Стоимость рассчитается для легкового автомобиля с дисками R16. Параметры можно уточнить при подтверждении.
            </p>
            <div className="form-grid">
              <label>
                Услуга
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {config.services
                    .filter((s) => s.enabled)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Дата
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                Время
                <input type="time" step="1800" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label>
                Имя
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Телефон
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="admin-primary"
              disabled={busy}
              onClick={add}
            >
              Добавить запись <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
