import { randomBytes, randomUUID } from "node:crypto";
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
export const listProjects = () =>
  db()
    .prepare("SELECT data FROM detail_projects")
    .all()
    .map((r) => decode<DetailProject>(r)!)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export function project(id: string) {
  const p = decode<DetailProject>(
    db().prepare("SELECT data FROM detail_projects WHERE id=?").get(id),
  );
  if (!p) throw new DetailError("Проект не найден", 404);
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
    if (
      !r.config.demo &&
      (!/^[78]\d{10}$/.test(r.config.phone.replace(/\D/g, "")) ||
        !r.config.address ||
        !r.config.legalName ||
        r.config.privacyText.length < 40)
    )
      throw new DetailError(
        "Для рабочего сайта заполните телефон, адрес, наименование оператора и текст обработки данных, затем согласуйте новую версию",
      );
    db()
      .prepare(
        "INSERT INTO detail_sites VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET config=excluded.config,version=excluded.version",
      )
      .run(id, JSON.stringify(r.config), r.version);
    p.publishedVersion = r.version;
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
    config: JSON.parse(row.config) as DetailConfig,
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
  const day = new Date(date + "T12:00:00+03:00");
  const now = Date.now();
  return (
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === date &&
    day.getTime() > now - 86400000 &&
    day.getTime() < now + 90 * 86400000 &&
    config.workDays.includes(day.getUTCDay())
  );
}
function slotData(
  site: ReturnType<typeof liveSite>,
  serviceId: string,
  date: string,
) {
  const service = site.config.services.find((s) => s.id === serviceId);
  if (!service || !validDate(site.config, date)) return [];
  const existing = bookings(site.projectId, date).filter(
    (b) => b.status !== "cancelled",
  );
  const slots: { time: string; bay: number }[] = [];
  for (
    let start = site.config.openHour * 60;
    start + service.duration <= site.config.closeHour * 60;
    start += 30
  ) {
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    if (new Date(`${date}T${time}:00+03:00`).getTime() < Date.now() + 3600000)
      continue;
    for (let bay = 1; bay <= site.config.capacity; bay++) {
      if (
        !existing.some((b) => {
          const [h, m] = b.time.split(":").map(Number);
          const t = h * 60 + m;
          return (
            b.bay === bay &&
            start < t + b.duration &&
            start + service.duration > t
          );
        })
      ) {
        slots.push({ time, bay });
        break;
      }
    }
  }
  return slots;
}
export function availableSlots(slug: string, service: string, date: string) {
  return slotData(liveSite(slug), service, date).map((s) => s.time);
}
export function createBooking(slug: string, input: unknown) {
  const v = bookingInputSchema.parse(input);
  if (v.website) throw new DetailError("Не удалось отправить заявку");
  return transaction(() => {
    const site = liveSite(slug);
    if (site.config.demo)
      throw new DetailError(
        "Это демонстрационный сайт. Приём заявок отключён.",
      );
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
    };
    db()
      .prepare("INSERT INTO detail_bookings VALUES(?,?,?,?)")
      .run(booking.id, site.projectId, booking.date, JSON.stringify(booking));
    return booking;
  });
}
export function changeBooking(
  projectId: string,
  id: string,
  status: DetailBooking["status"],
) {
  return transaction(() => {
    const b = decode<DetailBooking>(
      db()
        .prepare("SELECT data FROM detail_bookings WHERE id=? AND project_id=?")
        .get(id, projectId),
    );
    if (!b) throw new DetailError("Заявка не найдена", 404);
    if (b.status === "cancelled" && status !== "cancelled")
      throw new DetailError(
        "Отменённую заявку нельзя восстановить: время мог занять другой клиент",
        409,
      );
    b.status = status;
    db()
      .prepare("UPDATE detail_bookings SET data=? WHERE id=?")
      .run(JSON.stringify(b), id);
    return b;
  });
}
