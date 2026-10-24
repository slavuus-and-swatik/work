import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { DetailError } from "./errors";
import type { DetailBooking } from "./model";

const tokenSchema = z
  .string()
  .trim()
  .regex(
    /^\d{5,20}:[A-Za-z0-9_-]{25,100}$/,
    "Проверьте токен бота из BotFather",
  );
export const telegramConnectSchema = z.object({
  token: tokenSchema,
  chatId: z
    .string()
    .regex(/^-?\d{1,20}$/, "Выберите чат или введите числовой Chat ID"),
});
export const telegramTokenSchema = z.object({ token: tokenSchema });
type Connection = {
  revision: string;
  token: string;
  botId: number;
  botUsername: string;
  chatId: string;
  chatTitle: string;
  connectedAt: string;
  lastSentAt?: string;
  lastError?: string;
};
type Job = {
  id: string;
  project_id: string;
  booking_id: string;
  revision: string;
  state: string;
  attempts: number;
  next_at: number;
  lease_until: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};
const connection = (id: string): Connection | null => {
  const row = db()
    .prepare("SELECT data FROM detail_telegram_connections WHERE project_id=?")
    .get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
};
function save(id: string, value: Connection) {
  db()
    .prepare(
      "INSERT INTO detail_telegram_connections VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data",
    )
    .run(id, JSON.stringify(value));
}
function key() {
  const secret = process.env.PLATFORM_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new DetailError("Не настроен ключ защиты интеграций", 503);
  return createHash("sha256")
    .update("forma:telegram:" + secret)
    .digest();
}
function encrypt(value: string, id: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
function decrypt(value: string, id: string) {
  const raw = Buffer.from(value, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
class TelegramError extends Error {
  constructor(
    message: string,
    public permanent = false,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
function base() {
  // Only the isolated localhost QA fixture can redirect the transport.
  if (
    process.env.DETAILING_QA_TELEGRAM === "1" &&
    /^http:\/\/localhost:\d+$/.test(process.env.APP_ORIGIN || "") &&
    /^http:\/\/127\.0\.0\.1:\d+$/.test(
      process.env.DETAILING_TELEGRAM_QA_URL || "",
    )
  )
    return process.env.DETAILING_TELEGRAM_QA_URL!;
  return "https://api.telegram.org";
}
async function telegram(
  token: string,
  method: string,
  payload: Record<string, unknown> = {},
) {
  let response: Response;
  try {
    response = await fetch(`${base()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
  } catch {
    throw new TelegramError("Telegram временно недоступен. Повторим отправку.");
  }
  let value: {
    ok?: boolean;
    result?: any;
    error_code?: number;
    parameters?: { retry_after?: number };
  };
  try {
    value = await response.json();
  } catch {
    throw new TelegramError(
      "Telegram вернул неполный ответ. Повторим отправку.",
    );
  }
  if (!response.ok || !value.ok) {
    const code = value.error_code || response.status;
    if (code === 429)
      throw new TelegramError(
        "Telegram ограничил частоту отправки. Ожидаем повтор.",
        false,
        Math.min(86400, Math.max(1, value.parameters?.retry_after || 30)),
      );
    if (code === 401)
      throw new TelegramError(
        "Токен бота недействителен. Подключите бота заново.",
        true,
      );
    if (code === 403)
      throw new TelegramError(
        "Бот заблокирован или не может писать в этот чат.",
        true,
      );
    if (code === 409)
      throw new TelegramError(
        "Бот занят другой интеграцией. Используйте отдельного бота.",
        true,
      );
    if (code >= 400 && code < 500)
      throw new TelegramError(
        "Чат недоступен боту. Напишите /start или добавьте бота в группу с правом отправлять сообщения.",
        true,
      );
    throw new TelegramError("Ошибка Telegram. Повторим отправку.");
  }
  return value.result;
}
function setupError(error: unknown): never {
  throw new DetailError(
    error instanceof TelegramError
      ? error.message
      : "Не удалось настроить Telegram. Повторите попытку.",
    502,
  );
}
export async function telegramChats(input: unknown) {
  const { token } = telegramTokenSchema.parse(input);
  try {
    const bot = await telegram(token, "getMe");
    const hook = await telegram(token, "getWebhookInfo");
    if (hook.url)
      throw new TelegramError(
        "У бота уже подключена другая система. Создайте отдельного бота для уведомлений.",
        true,
      );
    const updates = await telegram(token, "getUpdates", {
      timeout: 0,
      limit: 100,
      allowed_updates: ["message", "channel_post"],
    });
    const chats = new Map<
      string,
      { id: string; title: string; type: string }
    >();
    for (const update of updates) {
      const c = (update.message || update.channel_post)?.chat;
      if (c?.id)
        chats.set(String(c.id), {
          id: String(c.id),
          title:
            c.title ||
            [c.first_name, c.last_name].filter(Boolean).join(" ") ||
            "Личный чат",
          type: c.type,
        });
    }
    return { botUsername: bot.username, chats: [...chats.values()].slice(-20) };
  } catch (error) {
    setupError(error);
  }
}
export async function connectTelegram(id: string, input: unknown) {
  const { token, chatId } = telegramConnectSchema.parse(input);
  try {
    const bot = await telegram(token, "getMe"),
      chat = await telegram(token, "getChat", { chat_id: chatId });
    if (!bot.is_bot || String(chat.id) !== chatId)
      throw new TelegramError(
        "Не удалось подтвердить бота и выбранный чат",
        true,
      );
    // Connectivity is checked without sending visitor contacts.
    await telegram(token, "sendMessage", {
      chat_id: chatId,
      text: "FORMA: уведомления подключены. Новые заявки будут приходить в этот чат. Контакты посетителей доступны в защищённом кабинете.",
      link_preview_options: { is_disabled: true },
    });
    transaction(() => {
      const old = connection(id);
      const revision =
        old && old.botId === bot.id && old.chatId === chatId
          ? old.revision
          : randomUUID();
      if (old && old.revision !== revision)
        db()
          .prepare(
            "UPDATE detail_notification_outbox SET state='cancelled',lease_until=0 WHERE project_id=? AND state IN ('pending','sending','failed')",
          )
          .run(id);
      save(id, {
        revision,
        token: encrypt(token, id),
        botId: bot.id,
        botUsername: bot.username,
        chatId,
        chatTitle:
          chat.title ||
          [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
          "Личный чат",
        connectedAt: new Date().toISOString(),
      });
    });
    return telegramStatus(id);
  } catch (error) {
    setupError(error);
  }
}
export function telegramStatus(id: string) {
  const c = connection(id);
  const counts = db()
    .prepare(
      "SELECT state,COUNT(*) AS count FROM detail_notification_outbox WHERE project_id=? GROUP BY state",
    )
    .all(id) as { state: string; count: number }[];
  const count = (state: string) =>
    counts.find((x) => x.state === state)?.count || 0;
  const jobs = db()
    .prepare(
      "SELECT booking_id AS bookingId,state,attempts,last_error AS error,created_at AS createdAt,sent_at AS sentAt FROM detail_notification_outbox WHERE project_id=? ORDER BY rowid DESC LIMIT 10",
    )
    .all(id);
  return {
    connected: !!c,
    connection: c
      ? {
          botUsername: c.botUsername,
          chatId: c.chatId,
          chatTitle: c.chatTitle,
          connectedAt: c.connectedAt,
          lastSentAt: c.lastSentAt,
          lastError: c.lastError,
        }
      : null,
    pending: count("pending") + count("sending"),
    failed: count("failed"),
    sent: count("sent"),
    jobs,
  };
}
export function disconnectTelegram(id: string) {
  transaction(() => {
    db()
      .prepare("DELETE FROM detail_telegram_connections WHERE project_id=?")
      .run(id);
    db()
      .prepare(
        "UPDATE detail_notification_outbox SET state='cancelled',lease_until=0 WHERE project_id=? AND state IN ('pending','sending','failed')",
      )
      .run(id);
  });
  return telegramStatus(id);
}
export async function testTelegram(id: string) {
  const c = connection(id);
  if (!c) throw new DetailError("Сначала подключите Telegram", 409);
  try {
    await telegram(decrypt(c.token, id), "sendMessage", {
      chat_id: c.chatId,
      text: "FORMA: проверка доставки. Уведомления о новых заявках включены.",
      link_preview_options: { is_disabled: true },
    });
    transaction(() => {
      const current = connection(id);
      if (current?.revision === c.revision)
        save(id, {
          ...current,
          lastError: undefined,
          lastSentAt: new Date().toISOString(),
        });
    });
    return telegramStatus(id);
  } catch (error) {
    setupError(error);
  }
}
export function retryTelegram(id: string) {
  const c = connection(id);
  if (!c) throw new DetailError("Подключите Telegram перед повтором", 409);
  db()
    .prepare(
      "UPDATE detail_notification_outbox SET state='pending',attempts=0,next_at=?,lease_until=0,last_error=NULL WHERE project_id=? AND revision=? AND state='failed'",
    )
    .run(Date.now(), id, c.revision);
  return telegramStatus(id);
}
export function queueTelegramBooking(b: DetailBooking) {
  if (b.sandbox) return;
  const c = connection(b.projectId);
  if (!c) return;
  db()
    .prepare(
      "INSERT INTO detail_notification_outbox(id,project_id,booking_id,revision,state,next_at,created_at) VALUES(?,?,?,?,'pending',?,?) ON CONFLICT(booking_id,revision) DO NOTHING",
    )
    .run(
      randomUUID(),
      b.projectId,
      b.id,
      c.revision,
      Date.now(),
      new Date().toISOString(),
    );
}
function claim(): Job | undefined {
  return transaction(() => {
    const now = Date.now();
    const job = db()
      .prepare(
        "SELECT * FROM detail_notification_outbox WHERE (state='pending' AND next_at<=?) OR (state='sending' AND lease_until<=?) ORDER BY next_at LIMIT 1",
      )
      .get(now, now) as Job | undefined;
    if (!job) return;
    db()
      .prepare(
        "UPDATE detail_notification_outbox SET state='sending',attempts=attempts+1,lease_until=? WHERE id=?",
      )
      .run(now + 45000, job.id);
    return { ...job, state: "sending", attempts: job.attempts + 1 };
  });
}
async function deliver(job: Job) {
  const c = connection(job.project_id);
  const row = db()
    .prepare(
      "SELECT b.data AS booking,p.data AS project FROM detail_bookings b JOIN detail_projects p ON p.id=b.project_id WHERE b.id=? AND b.project_id=?",
    )
    .get(job.booking_id, job.project_id) as
    | { booking: string; project: string }
    | undefined;
  if (!row || !c || c.revision !== job.revision) {
    db()
      .prepare(
        "UPDATE detail_notification_outbox SET state='cancelled',lease_until=0 WHERE id=?",
      )
      .run(job.id);
    return;
  }
  const b: DetailBooking = JSON.parse(row.booking),
    p = JSON.parse(row.project);
  if (b.sandbox || b.status === "cancelled" || b.status === "completed") {
    db()
      .prepare(
        "UPDATE detail_notification_outbox SET state='cancelled',lease_until=0 WHERE id=?",
      )
      .run(job.id);
    return;
  }
  try {
    const text = [
      `Новая заявка · ${p.draft.name}`,
      `№ ${b.id.slice(0, 8).toUpperCase()}`,
      b.serviceName,
      `${b.date.split("-").reverse().join(".")} · ${b.time} МСК`,
      `Стоимость от ${b.price.toLocaleString("ru-RU")} ₽`,
      `Статус: ${b.status === "confirmed" ? "подтверждена" : "ожидает подтверждения"}`,
      `${process.env.APP_ORIGIN}/client/${p.slug}?tab=bookings`,
    ].join("\n");
    const sent = await telegram(
      decrypt(c.token, job.project_id),
      "sendMessage",
      { chat_id: c.chatId, text, link_preview_options: { is_disabled: true } },
    );
    transaction(() => {
      db()
        .prepare(
          "UPDATE detail_notification_outbox SET state='sent',sent_at=?,lease_until=0,last_error=NULL,message_id=? WHERE id=? AND state='sending' AND attempts=?",
        )
        .run(new Date().toISOString(), sent.message_id, job.id, job.attempts);
      const current = connection(job.project_id);
      if (current?.revision === c.revision)
        save(job.project_id, {
          ...current,
          lastSentAt: new Date().toISOString(),
          lastError: undefined,
        });
    });
  } catch (error) {
    const failure =
      error instanceof TelegramError
        ? error
        : new TelegramError(
            "Не удалось отправить уведомление. Проверьте подключение бота.",
            true,
          );
    const failed = failure.permanent || job.attempts >= 8;
    const delays = [
      5000, 30000, 120000, 600000, 1800000, 3600000, 21600000, 86400000,
    ];
    const next =
      Date.now() +
      (failure.retryAfter
        ? failure.retryAfter * 1000
        : delays[Math.min(job.attempts - 1, delays.length - 1)]);
    transaction(() => {
      db()
        .prepare(
          "UPDATE detail_notification_outbox SET state=?,next_at=?,lease_until=0,last_error=? WHERE id=? AND state='sending' AND attempts=?",
        )
        .run(
          failed ? "failed" : "pending",
          next,
          failure.message,
          job.id,
          job.attempts,
        );
      const current = connection(job.project_id);
      if (current?.revision === c.revision)
        save(job.project_id, { ...current, lastError: failure.message });
    });
  }
}
export function startTelegramWorker() {
  const state = globalThis as typeof globalThis & {
    formaTelegramWorker?: boolean;
    formaTelegramRunning?: boolean;
  };
  if (
    state.formaTelegramWorker ||
    process.env.DETAILING_TELEGRAM_WORKER === "off"
  )
    return;
  state.formaTelegramWorker = true;
  const run = async () => {
    if (state.formaTelegramRunning) return;
    state.formaTelegramRunning = true;
    try {
      for (let i = 0; i < 10; i++) {
        const job = claim();
        if (!job) break;
        await deliver(job);
      }
    } catch {
      console.error("Telegram notification worker unavailable");
    } finally {
      state.formaTelegramRunning = false;
    }
  };
  setTimeout(() => void run(), 1000).unref();
  setInterval(() => void run(), 2000).unref();
}
