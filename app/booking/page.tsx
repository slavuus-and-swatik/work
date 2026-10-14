'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Heart,
  MapPin,
  Phone,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  defaultConfig,
  duration,
  money,
  priceFor,
  type Config,
  type Service,
} from '@/lib/shinslot';

type Slot = { time: string; free: number };
type MyBooking = {
  id: string;
  cancelToken: string;
  serviceName: string;
  wheelSize?: number;
  startsAt: string;
  status: string;
};
type BookingResult = {
  id: string;
  status: string;
  cancelToken: string;
  startsAt: string;
  error?: string;
};

const bookingStorageKey = 'shinslot-my-booking';
const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstBookableDate(config: Config, service: Service) {
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    const key = dateKey(day);
    if (!config.workDays.includes(day.getDay()) || config.closedDates.includes(key)) continue;
    const lastStart =
      new Date(`${key}T${config.close}:00+03:00`).getTime() - duration(config, service) * 60000;
    if (lastStart >= now + 20 * 60000) return key;
  }
  return dateKey(new Date());
}

function serviceIcon(name?: string) {
  switch (name) {
    case 'scissors':
      return <Scissors size={20} />;
    case 'sparkles':
      return <Sparkles size={20} />;
    case 'heart':
      return <Heart size={20} />;
    case 'shield':
      return <ShieldCheck size={20} />;
    case 'badge':
      return <Award size={20} />;
    case 'wheel':
      return <Sparkles size={20} />;
    case 'repair':
      return <Wrench size={20} />;
    case 'balance':
      return <Gauge size={20} />;
    default:
      return <Sparkles size={20} />;
  }
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const preselectedServiceId = searchParams.get('service');

  const [config, setConfig] = useState<Config>(defaultConfig);
  const [selected, setSelected] = useState<Service | null>(null);
  const [step, setStep] = useState(1);
  const [size, setSize] = useState(16);
  const [vehicle, setVehicle] = useState('car');
  const [runflat, setRunflat] = useState(false);
  const [date, setDate] = useState(dateKey(new Date()));
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotRequest, setSlotRequest] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: Config } | null) => {
        if (d?.config) {
          setConfig(d.config);
          if (preselectedServiceId) {
            const found = d.config.services.find((s) => s.id === preselectedServiceId && s.enabled);
            if (found) {
              setSelected(found);
              setDate(firstBookableDate(d.config, found));
              if (d.config.niche === 'auto') {
                setStep(2); // auto options
              } else {
                setStep(3); // direct calendar
              }
            }
          }
        }
      })
      .catch(() => {});
  }, [preselectedServiceId]);

  useEffect(() => {
    const isSlotStep = (config.niche === 'auto' && step === 3) || (config.niche !== 'auto' && step === 3);
    if (!selected || !isSlotStep) return;

    const controller = new AbortController();
    fetch(`/api/slots?date=${date}&service=${selected.id}`, { signal: controller.signal })
      .then(async (r) => {
        const data = (await r.json()) as { slots?: Slot[]; error?: string };
        if (!r.ok) throw new Error(data.error || 'Не удалось загрузить время');
        return data.slots || [];
      })
      .then((available) => {
        setSlots(available);
        setSlotError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setSlots([]);
          setSlotError(e instanceof Error ? e.message : 'Не удалось загрузить время');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotLoading(false);
      });

    return () => controller.abort();
  }, [selected, step, date, slotRequest, config.niche]);

  const dates = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );

  const price = selected
    ? priceFor(config, selected, config.niche === 'auto' ? size : undefined, vehicle, runflat)
    : 0;

  function chooseDate(key: string) {
    setDate(key);
    setTime('');
    setSlots([]);
    setSlotError('');
    setSlotLoading(true);
    setSlotRequest((v) => v + 1);
  }

  function pickService(s: Service) {
    setSelected(s);
    setDate(firstBookableDate(config, s));
    if (config.niche === 'auto') {
      setStep(2);
    } else {
      setStep(3);
    }
  }

  async function submit() {
    if (!selected || !time) return;
    setSending(true);
    setError('');
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selected.id,
          wheelSize: config.niche === 'auto' ? size : undefined,
          vehicleType: config.niche === 'auto' ? vehicle : undefined,
          runflat: config.niche === 'auto' ? runflat : undefined,
          date,
          time,
          name,
          phone,
        }),
      });
      const d = (await r.json()) as BookingResult;
      if (!r.ok) throw new Error(d.error || 'Не удалось записаться');
      const saved: MyBooking = {
        id: d.id,
        cancelToken: d.cancelToken,
        serviceName: selected.name,
        wheelSize: config.niche === 'auto' ? size : undefined,
        startsAt: d.startsAt,
        status: d.status,
      };
      localStorage.setItem(bookingStorageKey, JSON.stringify(saved));
      setResult(d);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка записи');
    } finally {
      setSending(false);
    }
  }

  const [bookingCat, setBookingCat] = useState<string>('all');
  const [bookingSearch, setBookingSearch] = useState<string>('');

  const enabledServices = config.services.filter((s) => s.enabled);

  const categories = useMemo(() => {
    const list: string[] = [];
    enabledServices.forEach((s) => {
      if (s.category?.trim() && !list.includes(s.category.trim())) {
        list.push(s.category.trim());
      }
    });
    return list;
  }, [enabledServices]);

  const filteredStepServices = useMemo(() => {
    return enabledServices.filter((s) => {
      const matchCat = bookingCat === 'all' || s.category === bookingCat;
      const q = bookingSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [enabledServices, bookingCat, bookingSearch]);

  const customStyle: Record<string, string | number> = { minHeight: '100vh', paddingBottom: '60px' };
  if (config.customAccent) {
    customStyle['--accent'] = config.customAccent;
  }
  if (config.customBg) {
    customStyle['--bg'] = config.customBg;
  }

  return (
    <div className={`site theme-${config.theme}`} style={customStyle as React.CSSProperties}>
      {/* Top Header */}
      <header className="app-header shell" style={{ marginBottom: '20px' }}>
        <Link href="/" className="header-contact-pill" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} />
          <span>На главную</span>
        </Link>
        <span style={{ fontWeight: 800, fontSize: '15px' }}>{config.name}</span>
        <a
          className="header-contact-pill"
          href={`tel:${config.phone.replace(/[^+\d]/g, '')}`}
        >
          <Phone size={15} />
          <span>{config.phone}</span>
        </a>
      </header>

      <main className="shell" style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header of Flow */}
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--line)', paddingBottom: '18px' }}>
            <span className="app-overline">ОНЛАЙН-ЗАПИСЬ КЛИЕНТОВ</span>
            <h1 style={{ fontSize: '26px', margin: '6px 0 0', letterSpacing: '-0.03em' }}>
              {step === 1
                ? 'Выберите услугу'
                : step === 2
                ? 'Параметры автомобиля'
                : step === 3
                ? 'Дата и время визита'
                : step === 4
                ? 'Контактные данные'
                : 'Запись подтверждена!'}
            </h1>
          </div>

          {/* STEP 1: SELECT SERVICE */}
          {step === 1 && (
            <div>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
                Выберите подходящую услугу из актуального прайса:
              </p>

              {/* Search bar and category pills if multiple services */}
              {enabledServices.length > 3 && (
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="service-search-wrap">
                    <span className="service-search-icon">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      className="service-search-input"
                      style={{ height: '42px', fontSize: '13px' }}
                      placeholder="Поиск по услугам..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                    />
                  </div>

                  {categories.length > 0 && (
                    <div className="service-category-pills">
                      <button
                        type="button"
                        className={`service-category-pill ${bookingCat === 'all' ? 'active' : ''}`}
                        onClick={() => setBookingCat('all')}
                      >
                        Все ({enabledServices.length})
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`service-category-pill ${bookingCat === cat ? 'active' : ''}`}
                          onClick={() => setBookingCat(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="choice-list">
                {filteredStepServices.length > 0 ? (
                  filteredStepServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickService(s)}
                      style={{ textAlign: 'left' }}
                    >
                      <span className="choice-icon">{serviceIcon(s.icon)}</span>
                      <span style={{ flex: 1 }}>
                        {s.category && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--accent)',
                              display: 'block',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                            }}
                          >
                            {s.category}
                          </span>
                        )}
                        <strong>{s.name}</strong>
                        <small>
                          {s.duration} мин · {s.inspection ? 'от ' : ''}
                          {money(s.price)}
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px' }}>
                    Ничего не найдено.
                    <button
                      type="button"
                      className="service-category-pill active"
                      style={{ margin: '8px auto', display: 'block' }}
                      onClick={() => {
                        setBookingSearch('');
                        setBookingCat('all');
                      }}
                    >
                      Сбросить фильтр
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: AUTO OPTIONS (FOR AUTO NICHE ONLY) */}
          {step === 2 && config.niche === 'auto' && selected && (
            <div>
              <button
                type="button"
                className="back"
                onClick={() => setStep(1)}
                style={{ marginBottom: '16px' }}
              >
                <ChevronLeft size={16} /> Назад к выбору услуги
              </button>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Выбранная услуга:</span>
                <strong style={{ fontSize: '15px' }}>{selected.name}</strong>
              </div>

              <p className="field-caption">Диаметр колёс</p>
              <div className="slot-grid" style={{ marginBottom: '20px' }}>
                {[14, 15, 16, 17, 18, 19, 20, 21].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={size === n ? 'selected' : ''}
                    onClick={() => setSize(n)}
                  >
                    R{n}
                  </button>
                ))}
              </div>

              <p className="field-caption">Тип автомобиля</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className={vehicle === 'car' ? 'selected' : ''}
                  onClick={() => setVehicle('car')}
                >
                  Легковой
                </button>
                <button
                  type="button"
                  className={vehicle === 'suv' ? 'selected' : ''}
                  onClick={() => setVehicle('suv')}
                >
                  Внедорожник (+500 ₽)
                </button>
              </div>

              <label className="switch-label" style={{ marginBottom: '20px' }}>
                <input
                  type="checkbox"
                  checked={runflat}
                  onChange={(e) => setRunflat(e.target.checked)}
                />{' '}
                Шины RunFlat (+800 ₽)
              </label>

              <div className="modal-summary">
                <span>Итоговая расчетная стоимость:</span>
                <strong>{money(price)}</strong>
              </div>

              <button
                type="button"
                className="modal-next"
                onClick={() => setStep(3)}
              >
                Выбрать дату и время <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 3: DATE & TIME SELECTION */}
          {step === 3 && selected && (
            <div>
              <button
                type="button"
                className="back"
                onClick={() => setStep(config.niche === 'auto' ? 2 : 1)}
                style={{ marginBottom: '16px' }}
              >
                <ChevronLeft size={16} /> Назад
              </button>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Услуга:</span>
                  <strong style={{ fontSize: '15px' }}>{selected.name}</strong>
                  {config.niche === 'auto' && (
                    <small style={{ color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                      R{size} · {vehicle === 'suv' ? 'Внедорожник' : 'Легковой'} {runflat ? '· RunFlat' : ''}
                    </small>
                  )}
                </div>
                <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{money(price)}</strong>
              </div>

              <p className="field-caption">Выберите день визита</p>
              <div className="date-strip" style={{ marginBottom: '20px' }}>
                {dates.map((d) => (
                  <button
                    key={dateKey(d)}
                    type="button"
                    className={date === dateKey(d) ? 'selected' : ''}
                    onClick={() => chooseDate(dateKey(d))}
                  >
                    <small>{weekdays[d.getDay()]}</small>
                    <strong>{d.getDate()}</strong>
                  </button>
                ))}
              </div>

              <p className="field-caption">
                Свободное время на {new Date(`${date}T12:00:00`).getDate()}{' '}
                {months[new Date(`${date}T12:00:00`).getMonth()]}
              </p>
              <div className="slot-grid" style={{ marginBottom: '16px' }}>
                {!slotLoading &&
                  slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      className={time === s.time ? 'selected' : ''}
                      onClick={() => setTime(s.time)}
                    >
                      {s.time}
                    </button>
                  ))}
              </div>

              {slotLoading ? (
                <p className="empty-slots">Проверяем свободные окна мастера...</p>
              ) : slotError ? (
                <p className="empty-slots" style={{ color: '#ff6b6b' }}>{slotError}</p>
              ) : slots.length === 0 ? (
                <p className="empty-slots">На эту дату нет свободных слотов. Пожалуйста, выберите другой день.</p>
              ) : null}

              <button
                type="button"
                className="modal-next"
                onClick={() => {
                  if (slotLoading) return;
                  if (!time) {
                    setSlotError('Пожалуйста, выберите удобное время из доступных слотов выше');
                    return;
                  }
                  setStep(4);
                }}
              >
                Продолжить к контактам <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 4: CLIENT CONTACT DETAILS */}
          {step === 4 && selected && (
            <div>
              <button
                type="button"
                className="back"
                onClick={() => setStep(3)}
                style={{ marginBottom: '16px' }}
              >
                <ChevronLeft size={16} /> Назад ко времени
              </button>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Услуга</span>
                  <strong>{selected.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Дата и время</span>
                  <strong>
                    {date.split('-').reverse().join('.')} в {time}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Стоимость</span>
                  <strong style={{ color: 'var(--accent)' }}>{selected.inspection ? 'от ' : ''}{money(price)}</strong>
                </div>
              </div>

              <label className="input-label">
                Ваше имя
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="Иван"
                  autoComplete="name"
                />
              </label>

              <label className="input-label">
                Номер телефона
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  placeholder="+7 (999) 000-00-00"
                  type="tel"
                  autoComplete="tel"
                />
              </label>

              {error && <p className="error">{error}</p>}

              <button
                type="button"
                className="modal-next"
                onClick={() => {
                  if (sending) return;
                  if (name.trim().length < 2) {
                    setError('Пожалуйста, укажите ваше имя (минимум 2 буквы)');
                    return;
                  }
                  const digits = phone.replace(/\D/g, '');
                  if (digits.length < 10) {
                    setError('Пожалуйста, укажите корректный номер телефона (от 10 цифр)');
                    return;
                  }
                  submit();
                }}
              >
                {sending ? 'Бронируем время...' : 'Подтвердить бронь'}{' '}
                <ArrowRight size={18} />
              </button>
              <p className="privacy">Нажимая кнопку, вы подтверждаете запись.</p>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 5 && result && (
            <div className="success" style={{ padding: '20px 0' }}>
              <span className="success-icon">
                <Check size={36} />
              </span>
              <h2 style={{ fontSize: '24px', letterSpacing: '-0.03em', margin: '0 0 10px' }}>
                {result.status === 'confirmed' ? 'Вы успешно записаны!' : 'Заявка принята!'}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '0 0 24px' }}>
                {result.status === 'confirmed'
                  ? 'Ждём вас точно к назначенному времени.'
                  : 'Мы свяжемся с вами для подтверждения времени.'}
              </p>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '18px',
                  marginBottom: '24px',
                  textAlign: 'left',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Дата и время:</span>
                  <strong style={{ fontSize: '16px' }}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    в {time}
                  </strong>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Услуга:</span>
                  <strong>{selected?.name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Адрес:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} style={{ color: 'var(--accent)' }} /> {config.address}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  className="cancel-link"
                  href={`/booking/${result.id}?token=${result.cancelToken}`}
                >
                  Управлять своей записью
                </Link>
                <Link href="/" className="modal-next" style={{ textDecoration: 'none' }}>
                  Вернуться на главную
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#080a0f', color: '#fff' }}>
          Загрузка онлайн-записи...
        </div>
      }
    >
      <BookingFlow />
    </Suspense>
  );
}
