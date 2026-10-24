import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import {
  defaultDetailConfig,
  detailConfigSchema,
  projectInputSchema,
  bookingInputSchema,
  type DetailConfig,
  type DetailProject,
  type DetailReview,
  type DetailBooking,
  type BookingMutation,
  type BookingEvent,
} from "./model";

export class DetailError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function decode<T>(row: unknown): T | null {
  return row ? (JSON.parse((row as { data: string }).data) as T) : null;
}
function displayConfig(config: DetailConfig): DetailConfig {
  if (!(config.demo && config.name === "FORMA" && config.accent === "#c9ed72"))
    return config;
  return {
    ...config,
    accent: defaultDetailConfig.accent,
    services: config.services.map((service) => ({
      ...service,
      image:
        service.image ||
        defaultDetailConfig.services.find((x) => x.id === service.id)?.image ||
        "",
    })),
  };
}
export const listProjects = () =>
  db()
    .prepare("SELECT data FROM detail_projects")
    .all()
    .map((r) => {
      const p = decode<DetailProject>(r)!;
      p.draft = displayConfig(p.draft);
      return p;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export function project(id: string) {
  const p = decode<DetailProject>(
    db().prepare("SELECT data FROM detail_projects WHERE id=?").get(id),
  );
  if (!p) throw new DetailError("Проект не найден", 404);
  p.draft = displayConfig(p.draft);
  return p;
}
function save(p: DetailProject) {
  p.updatedAt = new Date().toISOString();
  db()
    .prepare("UPDATE detail_projects SET data=? WHERE id=?")
    .run(JSON.stringify(p), p.id);
  return p;
}
export function createProject(input: unknown) {
  const fields = projectInputSchema.parse(input);
  const now = new Date().toISOString();
  const p: DetailProject = {
    ...fields,
    id: randomUUID(),
    draft: structuredClone(defaultDetailConfig),
    version: 1,
    reviewToken: null,
    reviewStatus: null,
    reviewVersion: null,
    reviewComment: "",
    publishedVersion: null,
    createdAt: now,
    updatedAt: now,
  };
  p.draft.name = fields.clientName;
  try {
    db()
      .prepare("INSERT INTO detail_projects VALUES(?,?,?)")
      .run(p.id, p.slug, JSON.stringify(p));
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new DetailError("Этот адрес уже занят", 409);
    throw e;
  }
  return p;
}
export function updateProject(
  id: string,
  input: {
    version: number;
    clientName: string;
    references: string[];
    config: unknown;
  },
) {
  const config = detailConfigSchema.parse(input.config);
  return transaction(() => {
    const p = project(id);
    if (p.version !== input.version)
      throw new DetailError(
        "Проект изменился в другой вкладке. Обновите страницу перед сохранением.",
        409,
      );
    const fields = projectInputSchema.parse({
      clientName: input.clientName,
      references: input.references,
      slug: p.slug,
    });
    if (p.reviewToken) {
      const r = review(p.reviewToken);
      r.status = "superseded";
      db()
        .prepare("UPDATE detail_reviews SET data=? WHERE token=?")
        .run(JSON.stringify(r), r.token);
    }
    p.draft = config;
    p.clientName = fields.clientName;
    p.references = fields.references;
    p.version++;
    p.reviewStatus = null;
    p.reviewToken = null;
    p.reviewVersion = null;
    p.reviewComment = "";
    return save(p);
  });
}
export function review(token: string) {
  const r = decode<DetailReview>(
    db().prepare("SELECT data FROM detail_reviews WHERE token=?").get(token),
  );
  if (!r) throw new DetailError("Ссылка не найдена", 404);
  return r;
}
export function requestReview(id: string, version: number) {
  return transaction(() => {
    const p = project(id);
    if (p.version !== version)
      throw new DetailError("Сначала обновите проект", 409);
    if (p.reviewToken && p.reviewVersion === version) return p;
    const r: DetailReview = {
      token: randomBytes(32).toString("base64url"),
      projectId: id,
      version,
      config: p.draft,
      status: "pending",
      comment: "",
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    db()
      .prepare("INSERT INTO detail_reviews VALUES(?,?,?)")
      .run(r.token, id, JSON.stringify(r));
    p.reviewToken = r.token;
    p.reviewVersion = version;
    p.reviewStatus = "pending";
    return save(p);
  });
}
export function decideReview(
  token: string,
  decision: "approved" | "changes",
  comment: string,
) {
  return transaction(() => {
    const r = review(token);
    const p = project(r.projectId);
    if (
      r.status !== "pending" ||
      p.reviewToken !== token ||
      p.version !== r.version
    )
      throw new DetailError(
        "Эта версия больше не ожидает ответа. Попросите студию прислать актуальную ссылку.",
        409,
      );
    if (decision === "changes" && !comment.trim())
      throw new DetailError("Опишите необходимые изменения");
    r.status = decision;
    r.comment = comment.trim();
    r.decidedAt = new Date().toISOString();
    db()
      .prepare("UPDATE detail_reviews SET data=? WHERE token=?")
      .run(JSON.stringify(r), token);
    p.reviewStatus = decision;
    p.reviewComment = r.comment;
    save(p);
    return r;
  });
}
export function publishProject(id: string, version: number) {
  return transaction(() => {
    const p = project(id);
    if (p.version !== version || !p.reviewToken)
      throw new DetailError(
        "Сначала отправьте текущую версию на согласование",
        409,
      );
    const r = review(p.reviewToken);
    if (r.status !== "approved" || r.version !== p.version)
      throw new DetailError(
        "Опубликовать можно только согласованную текущую версию",
        409,
      );
    assertPublishable(r.config);
    db()
      .prepare(
        "INSERT INTO detail_sites VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET config=excluded.config,version=excluded.version",
      )
      .run(id, JSON.stringify(r.config), r.version);
    p.publishedVersion = r.version;
    return save(p);
  });
}
function assertPublishable(config: DetailConfig) {
  if (
    !config.demo &&
    (!/^[78]\d{10}$/.test(config.phone.replace(/\D/g, "")) ||
      !config.address ||
      !config.legalName ||
      config.privacyText.length < 40)
  )
    throw new DetailError(
      "Для рабочего сайта заполните телефон, адрес, наименование оператора и текст обработки данных",
    );
}
export function updateClientContent(
  id: string,
  version: number,
  input: unknown,
) {
  const config = detailConfigSchema.parse(input);
  return transaction(() => {
    const p = project(id);
    if (p.publishedVersion === null)
      throw new DetailError("Кабинет доступен после запуска сайта", 409);
    if (p.version !== version)
      throw new DetailError(
        "Сайт изменился в другой вкладке. Обновите страницу.",
        409,
      );
    if (p.reviewToken) {
      const r = review(p.reviewToken);
      if (r.status === "pending") {
        r.status = "superseded";
        db()
          .prepare("UPDATE detail_reviews SET data=? WHERE token=?")
          .run(JSON.stringify(r), r.token);
      }
    }
    p.draft = config;
    p.version++;
    p.reviewToken = null;
    p.reviewStatus = null;
    p.reviewVersion = null;
    p.reviewComment = "";
    return save(p);
  });
}
export function publishClientContent(id: string, version: number) {
  return transaction(() => {
    const p = project(id);
    if (p.publishedVersion === null)
      throw new DetailError("Сайт ещё не передан клиенту", 409);
    if (p.version !== version)
      throw new DetailError("Сначала обновите проект", 409);
    const config = detailConfigSchema.parse(p.draft);
    assertPublishable(config);
    db()
      .prepare("UPDATE detail_sites SET config=?,version=? WHERE project_id=?")
      .run(JSON.stringify(config), p.version, id);
    p.publishedVersion = p.version;
    return save(p);
  });
}
export function unpublishProject(id: string) {
  return transaction(() => {
    const p = project(id);
    db().prepare("DELETE FROM detail_sites WHERE project_id=?").run(id);
    p.publishedVersion = null;
    return save(p);
  });
}
export function liveSite(slug: string) {
  const row = db()
    .prepare(
      "SELECT p.id,s.config,s.version FROM detail_projects p JOIN detail_sites s ON s.project_id=p.id WHERE p.slug=?",
    )
    .get(slug) as { id: string; config: string; version: number } | undefined;
  if (!row) throw new DetailError("Сайт пока не опубликован", 404);
  return {
    projectId: row.id,
    config: displayConfig(JSON.parse(row.config) as DetailConfig),
    version: row.version,
  };
}
export function bookings(projectId: string, date?: string) {
  return (
    date
      ? db()
          .prepare(
            "SELECT data FROM detail_bookings WHERE project_id=? AND date=?",
          )
          .all(projectId, date)
      : db()
          .prepare(
            "SELECT data FROM detail_bookings WHERE project_id=? ORDER BY date DESC",
          )
          .all(projectId)
  ).map((r) => decode<DetailBooking>(r)!);
}
function validDate(config: DetailConfig, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(date + "T12:00:00+03:00");
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
  return (
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === date &&
    date >= today &&
    day.getTime() < Date.now() + 90 * 86400000 &&
    config.workDays.includes(day.getUTCDay())
  );
}
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
function slotsForDuration(
  site: ReturnType<typeof liveSite>,
  duration: number,
  date: string,
  excludeId?: string,
) {
  if (!validDate(site.config, date)) return [];
  const existing = bookings(site.projectId, date).filter(
    (b) =>
      b.status !== "cancelled" &&
      b.id !== excludeId &&
      (!b.sandbox || site.config.demo),
  );
  const slots: { time: string; bay: number }[] = [];
  for (
    let start = site.config.openHour * 60;
    start + duration <= site.config.closeHour * 60;
    start += 30
  ) {
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    if (new Date(`${date}T${time}:00+03:00`).getTime() < Date.now() + 3600000)
      continue;
    const overlaps = existing.filter(
      (b) =>
        start < minutes(b.time) + b.duration &&
        start + duration > minutes(b.time),
    );
    // Count simultaneous occupation, including reservations on bays removed later.
    // Sequential visits inside one long visit must not be counted as simultaneous.
    const boundaries = overlaps
      .flatMap((b) => [
        [Math.max(start, minutes(b.time)), 1],
        [Math.min(start + duration, minutes(b.time) + b.duration), -1],
      ])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let occupation = 0;
    if (
      boundaries.some(
        ([, delta]) => (occupation += delta) >= site.config.capacity,
      )
    )
      continue;
    for (let bay = 1; bay <= site.config.capacity; bay++) {
      if (!overlaps.some((b) => b.bay === bay)) {
        slots.push({ time, bay });
        break;
      }
    }
  }
  return slots;
}
function slotData(
  site: ReturnType<typeof liveSite>,
  serviceId: string,
  date: string,
) {
  const service = site.config.services.find((s) => s.id === serviceId);
  return service ? slotsForDuration(site, service.duration, date) : [];
}
export function availableSlots(slug: string, service: string, date: string) {
  return slotData(liveSite(slug), service, date).map((s) => s.time);
}
export function createBooking(slug: string, input: unknown, sandbox = false) {
  const v = bookingInputSchema.parse(input);
  if (v.website) throw new DetailError("Не удалось отправить заявку");
  return transaction(() => {
    const site = liveSite(slug);
    if (site.config.demo && !sandbox)
      throw new DetailError(
        "Это демонстрационный сайт. Приём заявок отключён.",
      );
    if (sandbox && !site.config.demo)
      throw new DetailError(
        "Тестовая запись доступна только на демонстрационном сайте",
      );
    const tokenHash = v.submissionToken
      ? createHash("sha256").update(v.submissionToken).digest("hex")
      : null;
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          ...v,
          submissionToken: undefined,
          phone: "7" + v.phone.slice(1),
        }),
      )
      .digest("hex");
    if (tokenHash) {
      const existing = db()
        .prepare(
          "SELECT payload_hash,booking_id FROM detail_booking_receipts WHERE project_id=? AND token_hash=?",
        )
        .get(site.projectId, tokenHash) as
        | { payload_hash: string; booking_id: string }
        | undefined;
      if (existing) {
        if (existing.payload_hash !== payloadHash)
          throw new DetailError(
            "Эта отправка уже сохранена с другими данными. Проверьте её статус.",
            409,
          );
        return decode<DetailBooking>(
          db()
            .prepare("SELECT data FROM detail_bookings WHERE id=?")
            .get(existing.booking_id),
        )!;
      }
    }
    const slot = slotData(site, v.serviceId, v.date).find(
      (s) => s.time === v.time,
    );
    if (!slot)
      throw new DetailError("Это время уже занято. Выберите другое.", 409);
    const service = site.config.services.find((s) => s.id === v.serviceId)!;
    const booking: DetailBooking = {
      id: randomUUID(),
      projectId: site.projectId,
      serviceName: service.name,
      price: service.price,
      date: v.date,
      time: v.time,
      duration: service.duration,
      bay: slot.bay,
      name: v.name,
      phone: "7" + v.phone.slice(1),
      car: v.car,
      comment: v.comment,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      sandbox,
      staffNote: "",
    };
    db()
      .prepare("INSERT INTO detail_bookings VALUES(?,?,?,?)")
      .run(booking.id, site.projectId, booking.date, JSON.stringify(booking));
    recordBookingEvent(booking, "visitor", "created");
    if (tokenHash)
      db()
        .prepare("INSERT INTO detail_booking_receipts VALUES(?,?,?,?)")
        .run(site.projectId, tokenHash, payloadHash, booking.id);
    return booking;
  });
}
export function bookingReceipt(slug: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new DetailError("Некорректный номер проверки");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = db()
    .prepare(
      "SELECT b.data FROM detail_booking_receipts r JOIN detail_projects p ON p.id=r.project_id JOIN detail_bookings b ON b.id=r.booking_id WHERE p.slug=? AND r.token_hash=?",
    )
    .get(slug, tokenHash);
  const booking = decode<DetailBooking>(row);
  if (!booking) throw new DetailError("Заявка пока не найдена", 404);
  return booking;
}
export function publicBooking(booking: DetailBooking) {
  return {
    id: booking.id,
    date: booking.date,
    time: booking.time,
    serviceName: booking.serviceName,
    status: booking.status,
    sandbox: !!booking.sandbox,
  };
}
function getBooking(projectId: string, id: string) {
  const b = decode<DetailBooking>(
    db()
      .prepare("SELECT data FROM detail_bookings WHERE id=? AND project_id=?")
      .get(id, projectId),
  );
  if (!b) throw new DetailError("Заявка не найдена", 404);
  return { ...b, version: b.version || 1 };
}
function recordBookingEvent(
  b: DetailBooking,
  actor: BookingEvent["actor"],
  action: BookingEvent["action"],
  from?: BookingEvent["from"],
) {
  const event: BookingEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    from,
    to: { date: b.date, time: b.time, status: b.status },
    ...(action === "note" ? { note: b.staffNote } : {}),
  };
  db()
    .prepare("INSERT INTO detail_booking_events VALUES(?,?,?,?)")
    .run(event.id, b.projectId, b.id, JSON.stringify(event));
}
export function bookingHistory(projectId: string, id: string) {
  getBooking(projectId, id);
  return db()
    .prepare(
      "SELECT data FROM detail_booking_events WHERE project_id=? AND booking_id=? ORDER BY rowid",
    )
    .all(projectId, id)
    .map((r) => decode<BookingEvent>(r)!);
}
export function rescheduleSlots(projectId: string, id: string, date: string) {
  const b = getBooking(projectId, id);
  if (b.status === "cancelled" || b.status === "completed") return [];
  const site = liveSite(project(projectId).slug);
  return slotsForDuration(site, b.duration, date, b.id).map((s) => s.time);
}
export function mutateBooking(
  projectId: string,
  input: BookingMutation,
  actor: "agency" | "client",
) {
  return transaction(() => {
    const b = getBooking(projectId, input.id);
    if (input.version !== undefined && input.version !== b.version)
      throw new DetailError(
        "Заявка уже изменена в другой вкладке. Обновите список.",
        409,
      );
    const from = { date: b.date, time: b.time, status: b.status };
    if (input.action === "status") {
      const transitions: Record<
        DetailBooking["status"],
        DetailBooking["status"][]
      > = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };
      if (b.status === input.status) return b;
      if (!transitions[b.status].includes(input.status))
        throw new DetailError(
          "Этот переход статуса недоступен. Отменённые и завершённые визиты не восстанавливаются.",
          409,
        );
      b.status = input.status;
    } else if (input.action === "reschedule") {
      if (b.status === "cancelled" || b.status === "completed")
        throw new DetailError(
          "Перенести можно только новую или подтверждённую запись",
          409,
        );
      const site = liveSite(project(projectId).slug);
      const slot = slotsForDuration(site, b.duration, input.date, b.id).find(
        (s) => s.time === input.time,
      );
      if (!slot)
        throw new DetailError(
          "Новое время уже занято или недоступно. Исходная запись сохранена.",
          409,
        );
      b.date = input.date;
      b.time = input.time;
      b.bay = slot.bay;
    } else b.staffNote = input.note;
    b.version++;
    b.updatedAt = new Date().toISOString();
    db()
      .prepare(
        "UPDATE detail_bookings SET date=?,data=? WHERE id=? AND project_id=?",
      )
      .run(b.date, JSON.stringify(b), b.id, projectId);
    recordBookingEvent(b, actor, input.action, from);
    return b;
  });
}
export function changeBooking(
  projectId: string,
  id: string,
  status: DetailBooking["status"],
) {
  return mutateBooking(projectId, { action: "status", id, status }, "agency");
}
