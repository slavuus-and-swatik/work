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
import "./site.css";

export default function DetailingSite({
  config: c,
  slug,
  preview = false,
}: {
  config: DetailConfig;
  slug?: string;
  preview?: boolean;
}) {
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
  const dialog = useRef<HTMLDialogElement>(null);
  const service = c.services.find((s) => s.id === selected);
  const disabled = preview || c.demo || !slug;
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
    setLoading(true);
    setTime("");
    setError("");
    fetch(
      `/api/detailing/sites/${slug}/slots?service=${encodeURIComponent(selected)}&date=${date}`,
    )
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok) throw new Error(v.error);
        if (current) setSlots(v.slots);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selected, date, disabled, slug]);
  function open(id?: string) {
    setSuccess("");
    setError("");
    setDate("");
    setTime("");
    setSelected(id || c.services[0].id);
    setMenu(false);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/detailing/sites/${slug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selected,
          date,
          time,
          name: f.get("name"),
          phone: String(f.get("phone")).replace(/\D/g, ""),
          car: f.get("car"),
          comment: f.get("comment"),
          consent: f.get("consent") === "on",
          website: f.get("website"),
        }),
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setSuccess(
        `Заявка принята: ${v.booking.serviceName}, ${v.booking.date.split("-").reverse().join(".")} в ${v.booking.time} (МСК). Администратор свяжется с вами для подтверждения. Номер: ${v.booking.id.slice(0, 8).toUpperCase()}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dt" style={{ "--dt-accent": c.accent } as CSSProperties}>
      {c.demo && !preview && (
        <div className="dt-demo">
          Демонстрационный сайт · название, цены и изображения приведены для
          примера · запись отключена
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
                Ваш автомобиль.
                <br />
                <span>Наше внимание.</span>
              </h2>
            </div>
            <p>
              Выберите нужный уход.
              <br />
              Точную стоимость согласуем после осмотра.
            </p>
          </div>
          <div className="dt-service-list">
            {c.services.map((s, i) => (
              <article className="dt-service" key={s.id}>
                <span className="dt-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
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
            <div className="dt-gallery">
              {c.gallery.map((g, i) => (
                <figure key={i}>
                  <img loading="lazy" src={g.image} alt={g.caption} />
                  <figcaption>{g.caption}</figcaption>
                </figure>
              ))}
            </div>
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
              Вернём удовольствие
              <br />
              <span>от каждой детали.</span>
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
            {c.telegram && (
              <a href={c.telegram} target="_blank" rel="noreferrer">
                Написать в Telegram <ArrowUpRight size={15} />
              </a>
            )}
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
        <span>{c.legalName || "Демонстрационный шаблон детейлинга"}</span>
        <button onClick={() => setPrivacy(!privacy)}>Обработка данных</button>
      </footer>
      {privacy && (
        <section className="dt-privacy dt-section">
          <h3>Обработка персональных данных</h3>
          <p>
            {c.privacyText ||
              "В демонстрационном режиме заявки и персональные данные не собираются. Перед запуском рабочего сайта владелец добавляет сведения об операторе и условия обработки данных."}
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
                  : "Время указано по Москве. Подтверждение и итоговая стоимость — после связи с администратором."}
              </p>
              <form onSubmit={submit}>
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
                  Согласен на обработку имени, телефона и сведений об автомобиле
                  для организации записи.
                </label>
                <details className="dt-legal">
                  <summary>Условия обработки данных</summary>
                  <p>
                    {c.privacyText ||
                      "В демонстрационном режиме данные не отправляются."}
                  </p>
                </details>
                {error && (
                  <p className="dt-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="dt-primary"
                  disabled={busy || disabled || !time}
                >
                  {busy
                    ? "Отправляем…"
                    : disabled
                      ? "Демонстрация записи"
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
