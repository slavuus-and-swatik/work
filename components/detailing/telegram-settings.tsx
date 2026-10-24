"use client";
import { useEffect, useState } from "react";
import "./telegram-settings.css";
type Status = {
  connected: boolean;
  connection: {
    botUsername: string;
    chatId: string;
    chatTitle: string;
    lastSentAt?: string;
    lastError?: string;
  } | null;
  pending: number;
  failed: number;
  sent: number;
  jobs: {
    bookingId: string;
    state: string;
    attempts: number;
    error?: string;
    createdAt: string;
    sentAt?: string;
  }[];
};
async function api(action: string, body?: unknown) {
  const r = await fetch(`/api/client?action=${action}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const v = await r.json();
  if (!r.ok) throw new Error(v.error || "Не удалось выполнить действие");
  return v;
}
const states: Record<string, string> = {
  pending: "Ожидает отправки",
  sending: "Отправляем",
  sent: "Доставлено",
  failed: "Нужна проверка",
  cancelled: "Отправка отменена",
};
export default function TelegramSettings() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false);
  const [token, setToken] = useState(""),
    [chatId, setChatId] = useState(""),
    [chats, setChats] = useState<{ id: string; title: string; type: string }[]>(
      [],
    ),
    [bot, setBot] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void api("telegram")
        .then((v) => {
          if (active) {
            setStatus(v);
            setLoadError("");
          }
        })
        .catch(() => {
          if (active)
            setLoadError(
              "Не удалось обновить состояние Telegram. Повторите проверку.",
            );
        });
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Связь прервана. Проверьте состояние подключения.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tg-settings">
      <p className="tg-intro">
        Новая запись — сообщение в вашем личном чате или группе. В Telegram
        отправляем услугу, время и номер заявки. Контакты посетителя остаются в
        кабинете.
      </p>
      {status?.connected && (
        <div className="tg-connected">
          <strong>Подключён @{status.connection?.botUsername}</strong>
          <p>
            {status.connection?.chatTitle} · {status.connection?.chatId}
          </p>
          {status.connection?.lastSentAt && (
            <small>
              Последняя доставка:{" "}
              {new Date(status.connection.lastSentAt).toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
              })}{" "}
              МСК
            </small>
          )}
          <div className="tg-actions">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setStatus(await api("telegram-test", {}));
                  setNotice(
                    "Проверочное сообщение отправлено в подключённый чат.",
                  );
                })
              }
            >
              Проверить доставку
            </button>
            <button disabled={busy} onClick={() => setEditing(!editing)}>
              Изменить подключение
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setStatus(await api("telegram-disconnect", {}));
                  setNotice(
                    "Уведомления отключены. Заявки продолжают поступать в кабинет.",
                  );
                })
              }
            >
              Отключить
            </button>
          </div>
        </div>
      )}
      {status && (!status.connected || editing) && (
        <div className="tg-setup">
          <h2>Подключить свой чат</h2>
          <ol>
            <li>
              Создайте отдельного бота через{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
              >
                @BotFather
              </a>
              : команда /newbot. Скопируйте токен.
            </li>
            <li>
              Откройте своего бота и нажмите «Запустить». Для группы добавьте
              бота и отправьте в ней /start.
            </li>
            <li>Вставьте токен, найдите чат и подключите уведомления.</li>
          </ol>
          <label>
            Токен бота
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setChats([]);
                setChatId("");
                setBot("");
              }}
              placeholder="123456789:AA…"
            />
          </label>
          <button
            disabled={busy || !token.trim()}
            onClick={() =>
              void run(async () => {
                const v = await api("telegram-chats", { token: token.trim() });
                setChats(v.chats);
                setBot(v.botUsername);
                if (v.chats.length === 1) setChatId(v.chats[0].id);
                if (!v.chats.length)
                  setNotice(
                    "Чатов пока нет. Напишите боту /start, затем повторите поиск.",
                  );
              })
            }
          >
            Найти мои чаты
          </button>
          {bot && <p>Бот: @{bot}</p>}
          {chats.length > 0 && (
            <label>
              Куда отправлять уведомления
              <select
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              >
                <option value="">Выберите чат</option>
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {c.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <details>
            <summary>Ввести Chat ID вручную</summary>
            <label>
              Числовой Chat ID
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value.trim())}
                inputMode="text"
                placeholder="Например, -1001234567890"
              />
            </label>
          </details>
          <button
            className="tg-primary"
            disabled={busy || !token.trim() || !chatId}
            onClick={() =>
              void run(async () => {
                setStatus(
                  await api("telegram-connect", {
                    token: token.trim(),
                    chatId,
                  }),
                );
                setToken("");
                setChats([]);
                setEditing(false);
                setNotice(
                  "Telegram подключён. Проверочное сообщение отправлено в выбранный чат.",
                );
              })
            }
          >
            Подключить и отправить проверку
          </button>
          <p className="tg-muted">
            Используйте бота для этой студии. Токен хранится зашифрованным и не
            показывается повторно. При смене чата старые неотправленные
            уведомления не пересылаются в новый.
          </p>
        </div>
      )}
      {status?.connected && (
        <>
          <div className="tg-counts">
            <span>
              Доставлено <b>{status.sent}</b>
            </span>
            <span>
              В очереди <b>{status.pending}</b>
            </span>
            <span>
              С ошибкой <b>{status.failed}</b>
            </span>
          </div>
          {status.connection?.lastError && (
            <p className="tg-error">{status.connection.lastError}</p>
          )}
          {status.failed > 0 && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setStatus(await api("telegram-retry", {}));
                  setNotice("Неотправленные уведомления возвращены в очередь.");
                })
              }
            >
              Повторить неотправленные
            </button>
          )}
          <h3>Последние уведомления</h3>
          {status.jobs.length ? (
            status.jobs.map((j) => (
              <article className="tg-job" key={j.bookingId}>
                <strong>
                  № {j.bookingId.slice(0, 8).toUpperCase()} ·{" "}
                  {states[j.state] || j.state}
                </strong>
                <p>
                  {new Date(j.createdAt).toLocaleString("ru-RU", {
                    timeZone: "Europe/Moscow",
                  })}{" "}
                  МСК · Попыток: {j.attempts}
                </p>
                {j.error && <p>{j.error}</p>}
              </article>
            ))
          ) : (
            <p className="tg-muted">
              Здесь появится доставка следующей новой заявки.
            </p>
          )}
        </>
      )}
      {!status && !error && <p>Проверяем подключение…</p>}
      {(error || loadError) && (
        <p className="tg-error" role="alert">
          {error || loadError}
        </p>
      )}
      {notice && (
        <p className="tg-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
