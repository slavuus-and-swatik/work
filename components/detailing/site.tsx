"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  MapPin,
  X,
  Check,
  Phone,
  Menu,
} from "lucide-react";
import { money, type DetailConfig } from "@/lib/detailing/model";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import "./site.css";
import "./effects.css";
type Receipt = {
  id: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  sandbox?: boolean;
};
const receiptStatus: Record<string, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Запись подтверждена",
  completed: "Визит завершён",
  cancelled: "Запись отменена",
};

export default function DetailingSite({
  config: initialConfig,
  slug,
  preview = false,
}: {
  config: DetailConfig;
  slug?: string;
  preview?: boolean;
}) {
  const [c, setConfig] = useState(initialConfig);
  useEffect(() => setConfig(initialConfig), [initialConfig]);
  async function latestConfig() {
    if (preview || !slug) return c;
    const r = await fetch(`/api/detailing/sites/${slug}/config`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const v = await r.json();
    if (!r.ok) throw new Error(v.error || "Не удалось обновить сайт");
    setConfig((old) =>
      JSON.stringify(old) === JSON.stringify(v.config) ? old : v.config,
    );
    return v.config as DetailConfig;
  }
  useEffect(() => {
    if (preview || !slug) return;
    const refresh = () => {
      if (!document.hidden) void latestConfig().catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      clearInterval(timer);
    };
  }, [preview, slug]);
  const [selected, setSelected] = useState("");
  const [menu, setMenu] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptNote, setReceiptNote] = useState("");
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lastToken = useRef("");
  const submission = useRef<{
    token: string;
    payload: Record<string, unknown>;
    kind: "bookings" | "demo-bookings";
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const socialLinks = [
    ...(c.socialLinks || []),
    ...(c.telegram && !(c.socialLinks || []).some((x) => x.url === c.telegram)
      ? [{ label: "Telegram", url: c.telegram }]
      : []),
  ].filter((link) => link.url);
  const service = c.services.find((s) => s.id === selected);
  const disabled = preview || !slug;
  const sandbox = c.demo && !disabled;
  async function readReceipt(token: string) {
    const response = await fetch(`/api/detailing/sites/${slug}/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionToken: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return null;
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error || "Статус временно недоступен");
    return value.booking as Receipt;
  }
  function complete(booking: Receipt) {
    setReceipt(booking);
    setUncertain(false);
    submission.current = null;
    setSuccess(
      `${receiptStatus[booking.status] || booking.status}. ${booking.serviceName}, ${booking.date.split("-").reverse().join(".")} в ${booking.time} (МСК). Номер: ${booking.id.slice(0, 8).toUpperCase()}. ${booking.sandbox ? "Тестовая заявка сохранена. Реальный визит не требуется." : "Заявка сохранена в студии; администратор свяжется с вами."}`,
    );
    setReceiptNote("");
  }
  async function refreshReceipt() {
    if (!lastToken.current || checkingReceipt) return;
    setCheckingReceipt(true);
    try {
      const value = await readReceipt(lastToken.current);
      if (value) {
        setReceipt(value);
        setReceiptNote("");
        if (uncertain) complete(value);
      } else
        setReceiptNote(
          "Сохранение пока не подтверждено. Повторите проверку или отправку: повторная отправка защищена от дубликатов.",
        );
    } catch {
      setReceiptNote(
        "Не удалось связаться со студией. Статус пока неизвестен — проверьте ещё раз или позвоните.",
      );
    } finally {
      setCheckingReceipt(false);
    }
  }
  useEffect(() => {
    if (disabled) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem(`forma-receipt:${slug}`) || "null",
      );
      if (
        stored &&
        /^[a-f0-9]{64}$/.test(stored.token) &&
        Date.now() - stored.createdAt < 7 * 86400000
      ) {
        lastToken.current = stored.token;
        setReceiptNote("Проверяем последнюю заявку…");
        void readReceipt(stored.token)
          .then((value) => {
            if (value?.sandbox && !c.demo) {
              lastToken.current = "";
              setReceipt(null);
              setReceiptNote("");
              try {
                localStorage.removeItem(`forma-receipt:${slug}`);
              } catch {}
              return;
            }
            setReceipt(value);
            setReceiptNote(
              value
                ? ""
                : "Последняя отправка пока не найдена. Проверьте статус перед новой записью.",
            );
          })
          .catch(() =>
            setReceiptNote(
              "Статус последней заявки пока недоступен. Проверьте его повторно.",
            ),
          );
      }
    } catch {
      /* Storage is optional; the request still works in private mode. */
    }
  }, [slug, disabled, c.demo]);
  useEffect(() => {
    const element = root.current;
    if (
      !element ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("dt-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.04 },
    );
    element
      .querySelectorAll(".dt-section")
      .forEach((section) => observer.observe(section));
    element.dataset.motion = "on";
    return () => {
      observer.disconnect();
      delete element.dataset.motion;
    };
  }, [c.gallery.length, c.faqs.length]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  useEffect(() => {
    if (!selected || !date || disabled) {
      setSlots([]);
      return;
    }
    let current = true;
    setSlots([]);
    setTime("");
    setError("");
    async function load(initial = false) {
      if (initial) setLoading(true);
      try {
        const r = await fetch(
          `/api/detailing/sites/${slug}/slots?service=${encodeURIComponent(selected)}&date=${date}`,
          { signal: AbortSignal.timeout(10000) },
        );
        const v = await r.json();
        if (!r.ok) throw new Error(v.error);
        if (current) {
          setSlots(v.slots);
          setTime((old) => (v.slots.includes(old) ? old : ""));
        }
      } catch {
        if (current) {
          setSlots([]);
          setTime("");
          setError(
            "Не удалось обновить свободное время. Проверяем повторно; можно выбрать другую дату.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    void load(true);
    const timer = setInterval(() => void load(), 15000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [
    selected,
    date,
    disabled,
    slug,
    c.demo,
    c.services,
    c.openHour,
    c.closeHour,
    c.capacity,
    c.workDays,
  ]);
  function open(id?: string) {
    if (!preview && slug)
      void latestConfig()
        .then((next) => {
          if (!next.services.some((s) => s.id === (id || c.services[0].id)))
            setSelected(next.services[0].id);
        })
        .catch(() => setError("Не удалось обновить форму. Обновите страницу."));
    setSuccess("");
    setError("");
    if (uncertain && submission.current) {
      setError(
        "Результат предыдущей отправки пока неизвестен. Проверьте статус или повторите ту же заявку безопасно.",
      );
      setSelected(String(submission.current.payload.serviceId));
      setMenu(false);
      return;
    }
    setDate("");
    setTime("");
    setSelected(id || c.services[0].id);
    setMenu(false);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    if (!submission.current && !preview && slug) {
      try {
        const next = await latestConfig();
        const currentService = next.services.find((s) => s.id === selected);
        if (
          next.demo !== c.demo ||
          !currentService ||
          currentService.price !== service?.price ||
          currentService.duration !== service?.duration
        ) {
          if (!currentService) setSelected(next.services[0].id);
          setTime("");
          setError(
            "Сайт обновлён. Проверьте услугу, дату и время перед отправкой.",
          );
          setBusy(false);
          return;
        }
      } catch {
        setError(
          "Не удалось обновить форму. Заявка не отправлена. Попробуйте ещё раз.",
        );
        setBusy(false);
        return;
      }
    }
    let pending = submission.current;
    if (!pending) {
      const token =
        lastToken.current && !receipt
          ? lastToken.current
          : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join("");
      pending = {
        token,
        kind: sandbox ? "demo-bookings" : "bookings",
        payload: {
          serviceId: selected,
          date,
          time,
          name: f.get("name"),
          phone: String(f.get("phone")).replace(/\D/g, ""),
          car: f.get("car"),
          comment: f.get("comment"),
          consent: f.get("consent") === "on",
          website: f.get("website"),
          submissionToken: token,
        },
      };
      if (sandbox)
        pending.payload = {
          serviceId: selected,
          date,
          time,
          submissionToken: token,
        };
      submission.current = pending;
      lastToken.current = token;
      setReceipt(null);
      try {
        localStorage.setItem(
          `forma-receipt:${slug}`,
          JSON.stringify({ token, createdAt: Date.now() }),
        );
      } catch {}
    }
    try {
      const r = await fetch(`/api/detailing/sites/${slug}/${pending.kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.payload),
        signal: AbortSignal.timeout(15000),
      });
      const v = await r.json();
      if (!r.ok) {
        const saved = await readReceipt(pending.token);
        if (saved) {
          complete(saved);
          return;
        }
        if (r.status >= 400 && r.status < 500) {
          submission.current = null;
          lastToken.current = "";
          setUncertain(false);
          try {
            localStorage.removeItem(`forma-receipt:${slug}`);
          } catch {}
          setError(v.error || "Проверьте данные заявки");
          if (r.status === 409) {
            setTime("");
            setSlots([]);
            void fetch(
              `/api/detailing/sites/${slug}/slots?service=${encodeURIComponent(selected)}&date=${date}`,
              { signal: AbortSignal.timeout(10000) },
            )
              .then((r) => r.json())
              .then((v) => setSlots(v.slots || []))
              .catch(() => {});
          }
          return;
        }
        throw new Error("Сервер временно недоступен");
      }
      complete(v.booking);
    } catch (e) {
      try {
        const saved = await readReceipt(pending.token);
        if (saved) {
          complete(saved);
          return;
        }
      } catch {}
      setUncertain(true);
      setError(
        "Ответ студии не получен. Заявка могла сохраниться. Проверьте статус или повторите отправку — дубликат не появится.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      ref={root}
      className="dt"
      style={{ "--dt-accent": c.accent } as CSSProperties}
    >
      {c.demo && !preview && (
        <div className="dt-demo">
          Демонстрационный сайт · название, цены и изображения приведены для
          примера · тестовая запись с вымышленными контактами
        </div>
      )}
      <header className="dt-header">
        <a href="#top" className="dt-brand">
          {c.logo ? (
            <img src={c.logo} alt={c.name} />
          ) : (
            <>
              <span className="dt-mark">
                F<span>/</span>
              </span>
              <strong>{c.name}</strong>
            </>
          )}
        </a>
        <nav aria-label="Навигация" className={menu ? "is-open" : ""}>
          <a onClick={() => setMenu(false)} href="#services">
            Услуги и цены
          </a>
          {c.gallery.length > 0 && (
            <a onClick={() => setMenu(false)} href="#work">
              Работы
            </a>
          )}
          <a onClick={() => setMenu(false)} href="#about">
            Подход
          </a>
          <a onClick={() => setMenu(false)} href="#contacts">
            Контакты
          </a>
        </nav>
        <button className="dt-header-cta" onClick={() => open()}>
          Записаться <ArrowUpRight size={17} />
        </button>
        <button
          className="dt-menu"
          aria-label="Открыть меню"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Menu size={22} />
        </button>
      </header>
      {!disabled && (receipt || receiptNote) && (
        <div className="dt-receipt" role="status">
          <div>
            <strong>
              {receipt
                ? `${receiptStatus[receipt.status]} · ${receipt.serviceName}`
                : "Последняя заявка"}
            </strong>
            <span>
              {receipt
                ? `${receipt.date.split("-").reverse().join(".")} · ${receipt.time} МСК · № ${receipt.id.slice(0, 8).toUpperCase()}`
                : receiptNote}
            </span>
            {receipt && receiptNote && <span>{receiptNote}</span>}
          </div>
          <button
            disabled={checkingReceipt}
            onClick={() => void refreshReceipt()}
          >
            {checkingReceipt ? "Проверяем…" : "Обновить статус"}
          </button>
        </div>
      )}
      <main>
        <section className="dt-hero" id="top">
          <img
            className="dt-hero-image"
            src={c.hero}
            alt="Автомобиль в детейлинг-студии"
            fetchPriority="high"
          />
          <div className="dt-hero-shade" />
          <div className="dt-hero-copy">
            <p className="dt-eyebrow">
              <i />
              {c.eyebrow}
            </p>
            <h1>{c.headline}</h1>
            <p className="dt-intro">{c.description}</p>
            <button className="dt-primary" onClick={() => open()}>
              Подобрать уход <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="dt-hero-bottom">
            <span>
              <MapPin size={14} />
              {c.city}
            </span>
            <span>{c.hoursLabel}</span>
            <a href="#services">
              Откройте детали <span>↓</span>
            </a>
          </div>
        </section>
        <section className="dt-services dt-section" id="services">
          <div className="dt-section-heading">
            <div>
              <p className="dt-eyebrow">01 / УСЛУГИ</p>
              <h2>
                Уход за кузовом.
                <br />
                <span>Чистота салона.</span>
              </h2>
            </div>
            <p>
              Выберите нужный уход.
              <br />
              Объём работ и стоимость — после осмотра.
            </p>
          </div>
          <div className="dt-service-list">
            {c.services.map((s, i) => (
              <article className="dt-service" key={s.id}>
                <span className="dt-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.image && (
                  <img
                    className="dt-service-image"
                    src={s.image}
                    alt={s.name}
                    loading="lazy"
                  />
                )}
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                </div>
                <div className="dt-price">
                  <b>от {money(s.price)}</b>
                  <small>
                    {s.duration >= 60
                      ? `${Math.floor(s.duration / 60)} ч${s.duration % 60 ? " 30 мин" : ""}`
                      : `${s.duration} мин`}
                  </small>
                </div>
                <button
                  aria-label={`Записаться: ${s.name}`}
                  onClick={() => open(s.id)}
                >
                  <ArrowUpRight />
                </button>
              </article>
            ))}
          </div>
        </section>
        {c.gallery.length > 0 && (
          <section className="dt-section dt-work" id="work">
            <div className="dt-section-heading">
              <div>
                <p className="dt-eyebrow">02 / РАБОТЫ</p>
                <h2>
                  Результат
                  <br />
                  <span>говорит сам.</span>
                </h2>
              </div>
            </div>
            <PhotoProvider maskOpacity={0.95}>
              <div className="dt-gallery">
                {c.gallery.map((g, i) => (
                  <figure key={i}>
                    <PhotoView src={g.image}>
                      <button
                        className="dt-gallery-open"
                        aria-label={`Открыть фото: ${g.caption}`}
                      >
                        <img loading="lazy" src={g.image} alt={g.caption} />
                      </button>
                    </PhotoView>
                    <figcaption>{g.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </PhotoProvider>
          </section>
        )}
        <section className="dt-about dt-section" id="about">
          <p className="dt-eyebrow">
            {c.gallery.length ? "03" : "02"} / ПОДХОД
          </p>
          <div className="dt-about-grid">
            <h2>{c.aboutTitle}</h2>
            <div>
              <p>{c.aboutText}</p>
              <div className="dt-process">
                <span>
                  <b>01</b>Осмотр и задача
                </span>
                <span>
                  <b>02</b>Согласование работ
                </span>
                <span>
                  <b>03</b>Уход и рекомендации
                </span>
              </div>
            </div>
          </div>
        </section>
        {c.faqs.length > 0 && (
          <section className="dt-section dt-faq">
            <div>
              <p className="dt-eyebrow">ПЕРЕД ВИЗИТОМ</p>
              <h2>Есть вопросы?</h2>
            </div>
            <div>
              {c.faqs.map((f, i) => (
                <details key={i}>
                  <summary>
                    {f.question}
                    <Plus size={18} />
                  </summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
        <section className="dt-contact dt-section" id="contacts">
          <div>
            <p className="dt-eyebrow">СЛЕДУЮЩИЙ ШАГ</p>
            <h2>
              Сохраните характер
              <br />
              <span>вашего автомобиля.</span>
            </h2>
            <button className="dt-primary" onClick={() => open()}>
              Выбрать время <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="dt-contact-info">
            <span>{c.city}</span>
            <h3>{c.address || "Адрес студии появится здесь"}</h3>
            <p>{c.hoursLabel}</p>
            {c.phone && (
              <a
                className="dt-phone"
                href={"tel:" + c.phone.replace(/[^+\d]/g, "")}
              >
                <Phone size={18} />
                {c.phone}
              </a>
            )}
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <ArrowUpRight size={15} />
              </a>
            ))}
            {c.address && (
              <a
                href={
                  "https://yandex.ru/maps/?text=" +
                  encodeURIComponent(c.city + " " + c.address)
                }
                target="_blank"
                rel="noreferrer"
              >
                Построить маршрут <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </section>
      </main>
      <footer className="dt-footer">
        <strong>{c.name}</strong>
        <span>{c.legalName || "Уход за кузовом и салоном"}</span>
        <button onClick={() => setPrivacy(!privacy)}>Обработка данных</button>
      </footer>
      {privacy && (
        <section className="dt-privacy dt-section">
          <h3>Обработка персональных данных</h3>
          <p>
            {c.privacyText ||
              "В демонстрационном режиме используются вымышленные контакты. Перед запуском рабочего сайта владелец добавляет сведения об операторе и условия обработки данных."}
          </p>
        </section>
      )}
      <div className="dt-mobile-cta">
        <span>
          Уход начинается
          <br />
          <b>с одной записи</b>
        </span>
        <button className="dt-primary" onClick={() => open()}>
          Записаться <ArrowRight size={18} />
        </button>
      </div>
      <dialog
        ref={dialog}
        className="dt-dialog"
        onCancel={() => setSelected("")}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected("");
        }}
      >
        <div className="dt-dialog-inner">
          <button
            className="dt-close"
            aria-label="Закрыть запись"
            onClick={() => setSelected("")}
          >
            <X />
          </button>
          <p className="dt-eyebrow">ВАШ СЛЕДУЮЩИЙ ВИЗИТ</p>
          <h2>{success ? "Заявка отправлена" : "Запись в студию"}</h2>
          {success ? (
            <div className="dt-success">
              <Check />
              <p>{success}</p>
              <button className="dt-primary" onClick={() => setSelected("")}>
                Готово
              </button>
            </div>
          ) : (
            <>
              <p className="dt-form-note">
                {disabled
                  ? "Предпросмотр формы. Реальные заявки здесь не отправляются."
                  : sandbox
                    ? "Тестовая запись с вымышленными контактами. Реальный визит не требуется. Заявку можно обработать в админке."
                    : "Время указано по Москве. Подтверждение и итоговая стоимость — после связи с администратором."}
              </p>
              <form onSubmit={submit}>
                <fieldset disabled={busy || uncertain}>
                  <label>
                    Услуга
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {c.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — от {money(s.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="dt-form-grid">
                    <label>
                      Дата
                      <input
                        required
                        type="date"
                        min={new Date().toLocaleDateString("en-CA", {
                          timeZone: "Europe/Moscow",
                        })}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Время
                      <select
                        required
                        disabled={loading || !date}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      >
                        <option value="">
                          {loading
                            ? "Загрузка…"
                            : date
                              ? "Выберите время"
                              : "Сначала дата"}
                        </option>
                        {(disabled ? ["10:00", "12:00", "15:00"] : slots).map(
                          (t) => (
                            <option key={t}>{t}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  {date && !disabled && !loading && !slots.length && (
                    <p className="dt-form-note">
                      Нет свободного времени на эту дату. Выберите другой день.
                    </p>
                  )}
                  {!sandbox && (
                    <>
                      <div className="dt-form-grid">
                        <label>
                          Ваше имя
                          <input
                            name="name"
                            autoComplete="name"
                            required
                            minLength={2}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Телефон
                          <input
                            name="phone"
                            autoComplete="tel"
                            inputMode="tel"
                            required
                            placeholder="79991234567"
                            maxLength={11}
                            pattern="[78][0-9]{10}"
                            onInput={(e) => {
                              e.currentTarget.value = e.currentTarget.value
                                .replace(/\D/g, "")
                                .slice(0, 11);
                            }}
                          />
                        </label>
                      </div>
                      <label>
                        Автомобиль
                        <input
                          name="car"
                          required
                          maxLength={120}
                          placeholder="Марка и модель"
                        />
                      </label>
                      <label>
                        Комментарий
                        <textarea
                          name="comment"
                          maxLength={700}
                          placeholder="Что важно учесть?"
                        />
                      </label>
                      <input
                        className="dt-trap"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                      />
                      <label className="dt-consent">
                        <input type="checkbox" name="consent" required />
                        Согласен на обработку имени, телефона и сведений об
                        автомобиле для организации записи.
                      </label>
                      <details className="dt-legal">
                        <summary>Условия обработки данных</summary>
                        <p>
                          {c.privacyText ||
                            "В демонстрационном режиме данные не отправляются."}
                        </p>
                      </details>
                    </>
                  )}
                </fieldset>
                {error && (
                  <p className="dt-error" role="alert">
                    {error}
                  </p>
                )}
                {uncertain && (
                  <button
                    type="button"
                    className="dt-status-check"
                    disabled={busy || checkingReceipt}
                    onClick={() => void refreshReceipt()}
                  >
                    Проверить, сохранилась ли заявка
                  </button>
                )}
                <button
                  className="dt-primary"
                  disabled={
                    busy || disabled || (!uncertain && (loading || !time))
                  }
                >
                  {busy
                    ? "Отправляем…"
                    : disabled
                      ? "Демонстрация записи"
                      : uncertain
                        ? "Повторить безопасно"
                        : sandbox
                          ? "Создать тестовую заявку"
                          : `Оставить заявку · от ${money(service?.price || 0)}`}
                  <ArrowUpRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
