"use client";
import { useEffect, useState } from "react";
import {
  money,
  type DetailBooking,
  type BookingEvent,
  type BookingMutation,
} from "@/lib/detailing/model";
import "./booking-manager.css";
const labels: Record<string, string> = {
  pending: "Новая",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  completed: "Завершена",
};
type Props = {
  bookings: DetailBooking[];
  projectId?: string;
  onChange: (b: DetailBooking) => void;
  onRefresh: () => Promise<void>;
};
export default function BookingManager(props: Props) {
  const [filter, setFilter] = useState("");
  const [day, setDay] = useState("");
  return (
    <section className="bm">
      <div className="bm-filters">
        <label>
          Статус
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Все заявки</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
      </div>
      <p className="bm-muted">
        Новых: {props.bookings.filter((b) => b.status === "pending").length} ·
        Подтверждено:{" "}
        {props.bookings.filter((b) => b.status === "confirmed").length}
      </p>
      {!props.bookings.some(
        (b) => (!filter || b.status === filter) && (!day || b.date === day),
      ) && <p className="bm-muted">Нет заявок по выбранным фильтрам.</p>}
      {props.bookings
        .filter(
          (b) => (!filter || b.status === filter) && (!day || b.date === day),
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map((b) => (
          <BookingCard key={b.id} {...props} booking={b} />
        ))}
    </section>
  );
}
function BookingCard({
  booking: b,
  projectId,
  onChange,
  onRefresh,
}: Props & { booking: DetailBooking }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [move, setMove] = useState(false),
    [date, setDate] = useState(b.date),
    [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]),
    [loading, setLoading] = useState(false);
  const [note, setNote] = useState(b.staffNote || ""),
    [editing, setEditing] = useState(false);
  const [editVersion, setEditVersion] = useState(b.version || 1),
    [moveVersion, setMoveVersion] = useState(b.version || 1);
  const [history, setHistory] = useState<BookingEvent[] | null>(null);
  const endpoint = (action: string, query = "") =>
    projectId
      ? `/api/detailing/projects/${projectId}/${action}${query ? "?" + query : ""}`
      : `/api/client?action=${action}${query ? "&" + query : ""}`;
  async function request(
    action: string,
    method = "GET",
    payload?: unknown,
    query = "",
  ) {
    const r = await fetch(endpoint(action, query), {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const v = await r.json();
    if (!r.ok) {
      if (r.status === 409) await onRefresh();
      throw new Error(v.error || "Не удалось выполнить действие");
    }
    return v;
  }
  useEffect(() => {
    if (!editing) setNote(b.staffNote || "");
  }, [b.staffNote, editing]);
  useEffect(() => {
    if (!move || !date) return;
    let active = true;
    setLoading(true);
    setSlots([]);
    setTime("");
    request(
      "booking-slots",
      "GET",
      undefined,
      new URLSearchParams({ bookingId: b.id, date }).toString(),
    )
      .then((v) => {
        if (active) setSlots(v.slots);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [move, date, b.id, b.version]);
  async function mutate(
    value: Partial<BookingMutation>,
    version = b.version || 1,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const v = await request("bookings", "PATCH", {
        ...value,
        id: b.id,
        version,
      });
      onChange(v.booking);
      setEditVersion(v.booking.version || 1);
      setMove(false);
      setEditing(false);
      setHistory(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Связь прервана. Обновите список перед повторным действием.",
      );
      await onRefresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const active = b.status === "pending" || b.status === "confirmed";
  const end =
    Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(3)) + b.duration;
  return (
    <article className="bm-card">
      <div className="bm-meta">
        <span className={`bm-badge bm-${b.status}`}>{labels[b.status]}</span>
        <small>№ {b.id.slice(0, 8).toUpperCase()}</small>
        {b.sandbox && <span className="bm-badge">Тестовая запись</span>}
      </div>
      <h3>{b.serviceName}</h3>
      <p>
        <strong>
          {b.date.split("-").reverse().join(".")} · {b.time}–
          {String(Math.floor(end / 60)).padStart(2, "0")}:
          {String(end % 60).padStart(2, "0")} МСК
        </strong>
        <br />
        Пост {b.bay} · {b.duration} мин · от {money(b.price)}
      </p>
      <p>
        {b.name} · {b.car}
        <br />
        {b.sandbox ? (
          <span className="bm-muted">
            Контакты вымышленные — звонить не нужно
          </span>
        ) : (
          <a href={`tel:+${b.phone}`}>+{b.phone}</a>
        )}
      </p>
      {b.comment && <p>{b.comment}</p>}
      <div className="bm-actions">
        {b.status === "pending" && (
          <button
            disabled={busy}
            onClick={() =>
              void mutate({ action: "status", status: "confirmed" })
            }
          >
            Подтвердить
          </button>
        )}
        {b.status === "confirmed" && (
          <button
            disabled={busy}
            onClick={() =>
              void mutate({ action: "status", status: "completed" })
            }
          >
            Завершить визит
          </button>
        )}
        {active && (
          <>
            <button
              disabled={busy}
              onClick={() => {
                setMove(!move);
                setMoveVersion(b.version || 1);
                setError("");
              }}
            >
              Перенести
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Отменить запись? Время станет доступно другим клиентам.",
                  )
                )
                  void mutate({ action: "status", status: "cancelled" });
              }}
            >
              Отменить запись
            </button>
          </>
        )}
      </div>
      {move && (
        <div className="bm-editor">
          <label>
            Новая дата
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Свободное время
            <select
              disabled={loading}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            >
              <option value="">
                {loading ? "Проверяем…" : "Выберите время"}
              </option>
              {slots.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {!loading && !slots.length && (
            <p>Нет доступного времени. Выберите другой день.</p>
          )}
          <button
            disabled={busy || loading || !time}
            onClick={() =>
              void mutate({ action: "reschedule", date, time }, moveVersion)
            }
          >
            Сохранить перенос
          </button>
          <p className="bm-muted">
            До успешного переноса исходное время остаётся за клиентом.
          </p>
        </div>
      )}
      <details
        onToggle={(e) => {
          setEditing(e.currentTarget.open);
          if (e.currentTarget.open) setEditVersion(b.version || 1);
        }}
      >
        <summary>Заметка администратора</summary>
        <textarea
          aria-label="Заметка администратора"
          maxLength={1500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          disabled={busy || note === (b.staffNote || "")}
          onClick={() => void mutate({ action: "note", note }, editVersion)}
        >
          Сохранить заметку
        </button>
        <p className="bm-muted">Видна только в админках.</p>
      </details>
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !history)
            void request(
              "booking-history",
              "GET",
              undefined,
              new URLSearchParams({ bookingId: b.id }).toString(),
            )
              .then((v) => setHistory(v.events))
              .catch((e) => setError(e.message));
        }}
      >
        <summary>История заявки</summary>
        {history === null ? (
          <p>Загружаем…</p>
        ) : history.length ? (
          history.map((h) => (
            <p className="bm-event" key={h.id}>
              <small>
                {new Date(h.at).toLocaleString("ru-RU", {
                  timeZone: "Europe/Moscow",
                })}{" "}
                МСК ·{" "}
                {h.actor === "visitor"
                  ? "Сайт"
                  : h.actor === "agency"
                    ? "Студия"
                    : "Кабинет клиента"}
              </small>
              <br />
              {h.action === "created"
                ? "Заявка создана"
                : h.action === "note"
                  ? `Заметка: ${h.note || "очищена"}`
                  : h.action === "status"
                    ? `${labels[h.from?.status || ""]} → ${labels[h.to.status]}`
                    : `Перенос: ${h.from?.date} ${h.from?.time} → ${h.to.date} ${h.to.time}`}
            </p>
          ))
        ) : (
          <p>У старой заявки история ещё не велась.</p>
        )}
      </details>
      {error && (
        <p role="alert" className="bm-error">
          {error}
        </p>
      )}
    </article>
  );
}
