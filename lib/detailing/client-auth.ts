import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { db, rateLimit, transaction } from "./db";
import { DetailError, project } from "./store";

const COOKIE = "detail_client_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const INVITE_SECONDS = 60 * 60 * 24 * 7;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secure = (req: Request) => new URL(process.env.APP_ORIGIN || req.url).protocol === "https:" ? "; Secure" : "";
const token = () => randomBytes(32).toString("base64url");
function cookie(req: Request) {
  return req.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
}
function access(projectId: string) {
  return db().prepare("SELECT password_hash,invite_hash,invite_expires FROM detail_client_access WHERE project_id=?").get(projectId) as { password_hash: string | null; invite_hash: string | null; invite_expires: number | null } | undefined;
}
export function clientProject(req: Request) {
  const value = cookie(req);
  if (!/^[\w-]{40,50}$/.test(value)) return null;
  const row = db().prepare("SELECT project_id,expires FROM detail_client_sessions WHERE token_hash=?").get(digest(value)) as {project_id:string;expires:number} | undefined;
  return row && row.expires > Date.now() ? row.project_id : null;
}
export function issueInvite(projectId: string) {
  const p = project(projectId);
  if (p.publishedVersion === null) throw new DetailError("Сначала опубликуйте согласованный сайт", 409);
  const invite = token();
  transaction(() => {
    db().prepare("INSERT INTO detail_client_access(project_id,password_hash,invite_hash,invite_expires) VALUES(?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET invite_hash=excluded.invite_hash,invite_expires=excluded.invite_expires")
      .run(projectId, access(projectId)?.password_hash || null, digest(invite), Date.now() + INVITE_SECONDS * 1000);
  });
  return invite;
}
function session(req: Request, projectId: string) {
  const value = token();
  db().prepare("DELETE FROM detail_client_sessions WHERE expires<=?").run(Date.now());
  db().prepare("INSERT INTO detail_client_sessions VALUES(?,?,?)").run(digest(value), projectId, Date.now() + SESSION_SECONDS * 1000);
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure(req)}`;
}
export async function acceptInvite(req: Request, slug: string, invite: unknown, password: unknown) {
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) throw new DetailError("Пароль должен содержать от 12 символов и занимать не более 72 байт UTF-8");
  if (typeof invite !== "string" || !/^[\w-]{40,50}$/.test(invite)) throw new DetailError("Ссылка приглашения недействительна", 400);
  const p = projectBySlug(slug);
  const row = access(p.id);
  const expected = row?.invite_hash;
  if (!expected || !row?.invite_expires || row.invite_expires < Date.now() || !timingSafeEqual(Buffer.from(expected), Buffer.from(digest(invite)))) throw new DetailError("Ссылка приглашения истекла или уже использована", 409);
  const passwordHash = await hash(password, 12);
  transaction(() => {
    const current = access(p.id);
    if (!current?.invite_hash || current.invite_hash !== expected || (current.invite_expires || 0) < Date.now()) throw new DetailError("Ссылка приглашения уже использована", 409);
    db().prepare("UPDATE detail_client_access SET password_hash=?,invite_hash=NULL,invite_expires=NULL WHERE project_id=?").run(passwordHash, p.id);
    db().prepare("DELETE FROM detail_client_sessions WHERE project_id=?").run(p.id);
  });
  return session(req, p.id);
}
export function projectBySlug(slug: string) {
  const row = db().prepare("SELECT id FROM detail_projects WHERE slug=?").get(slug) as {id:string} | undefined;
  if (!row) throw new DetailError("Проект не найден", 404);
  return project(row.id);
}
export async function loginClient(req: Request, slug: string, password: unknown) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!rateLimit(`client-login-ip:${digest(ip)}`, 40, 3600) || !rateLimit(`client-login:${slug}:${digest(ip)}`, 10, 3600)) throw new DetailError("Слишком много попыток. Попробуйте позже.", 429);
  const p = projectBySlug(slug);
  const pass = access(p.id)?.password_hash;
  if (!pass || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72 || !(await compare(password, pass))) throw new DetailError("Неверный пароль", 401);
  return session(req, p.id);
}
export function logoutClient(req: Request) {
  const value = cookie(req);
  if (value) db().prepare("DELETE FROM detail_client_sessions WHERE token_hash=?").run(digest(value));
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure(req)}`;
}
