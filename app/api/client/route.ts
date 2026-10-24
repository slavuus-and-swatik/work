import { ZodError, z } from "zod";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { saveUpload } from "@/lib/detailing/assets";
import * as auth from "@/lib/detailing/client-auth";
import * as store from "@/lib/detailing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200, cookie?: string) => {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
};
async function input(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 100000) throw new store.DetailError("Слишком большой запрос", 413);
  const raw = await req.text();
  if (raw.length > 100000) throw new store.DetailError("Слишком большой запрос", 413);
  return JSON.parse(raw);
}
function requireClient(req: Request) {
  const id = auth.clientProject(req);
  if (!id) throw new store.DetailError("Войдите в кабинет клиента", 401);
  return id;
}
function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== (process.env.APP_ORIGIN || new URL(req.url).origin)) throw new store.DetailError("Недопустимый источник запроса", 403);
}
async function handle(req: Request) {
  try {
    if (req.method !== "GET") checkOrigin(req);
    const action = new URL(req.url).searchParams.get("action") || "session";
    if (action === "invite" && req.method === "POST") {
      if (!isPlatformAdmin(req)) throw new store.DetailError("Войдите в студию", 401);
      const { projectId } = z.object({ projectId: z.string().uuid() }).parse(await input(req));
      const invite = auth.issueInvite(projectId);
      const p = store.project(projectId);
      return json({ invite, path: `/client/${p.slug}#invite=${invite}` }, 201);
    }
    if (action === "activate" && req.method === "POST") {
      const { slug, invite, password } = z.object({ slug: z.string(), invite: z.string(), password: z.string() }).parse(await input(req));
      const cookie = await auth.acceptInvite(req, slug, invite, password);
      return json({ authenticated: true }, 200, cookie);
    }
    if (action === "login" && req.method === "POST") {
      const { slug, password } = z.object({ slug: z.string(), password: z.string() }).parse(await input(req));
      const cookie = await auth.loginClient(req, slug, password);
      return json({ authenticated: true }, 200, cookie);
    }
    if (action === "session" && req.method === "DELETE") return json({ authenticated: false }, 200, auth.logoutClient(req));
    if (action === "session" && req.method === "GET") {
      const id = auth.clientProject(req);
      return json(id ? { authenticated: true, slug: store.project(id).slug } : { authenticated: false });
    }
    const id = requireClient(req);
    if (action === "project" && req.method === "GET") {
      const p = store.project(id);
      return json({ project: { id: p.id, slug: p.slug, clientName: p.clientName, draft: p.draft, version: p.version, publishedVersion: p.publishedVersion } });
    }
    if (action === "project" && req.method === "PATCH") {
      const v = z.object({ version: z.number().int(), config: z.unknown() }).parse(await input(req));
      const p = store.updateClientContent(id, v.version, v.config);
      return json({ project: { id: p.id, slug: p.slug, clientName: p.clientName, draft: p.draft, version: p.version, publishedVersion: p.publishedVersion } });
    }
    if (action === "publish" && req.method === "POST") {
      const { version } = z.object({ version: z.number().int() }).parse(await input(req));
      const p = store.publishClientContent(id, version);
      return json({ project: { id: p.id, slug: p.slug, clientName: p.clientName, draft: p.draft, version: p.version, publishedVersion: p.publishedVersion } });
    }
    if (action === "bookings" && req.method === "GET") return json({ bookings: store.bookings(id) });
    if (action === "bookings" && req.method === "PATCH") {
      const v = z.object({ id: z.string(), status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).parse(await input(req));
      return json({ booking: store.changeBooking(id, v.id, v.status) });
    }
    if (action === "upload" && req.method === "POST") return json(await saveUpload(req, id, 30), 201);
    return json({ error: "Страница не найдена" }, 404);
  } catch (error) {
    if (error instanceof store.DetailError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400);
    if (error instanceof SyntaxError) return json({ error: "Некорректный запрос" }, 400);
    console.error("Client API error", error);
    return json({ error: "Не удалось выполнить действие" }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
