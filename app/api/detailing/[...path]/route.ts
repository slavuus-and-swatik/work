import { createHash } from "node:crypto";
import { z, ZodError } from "zod";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { db, rateLimit } from "@/lib/detailing/db";
import * as store from "@/lib/detailing/store";
import { saveUpload } from "@/lib/detailing/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
  if (origin && origin !== expected)
    throw new store.DetailError("Недопустимый источник запроса", 403);
}
async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 100000)
    throw new store.DetailError("Слишком большой запрос", 413);
  return JSON.parse(raw);
}
async function handle(req: Request, ctx: Context) {
  try {
    const parts = (await ctx.params).path;
    const [scope, id, action] = parts;
    const method = req.method;
    const url = new URL(req.url);
    if (method !== "GET") checkOrigin(req);
    if (scope === "projects" || scope === "upload") {
      if (!isPlatformAdmin(req))
        return json({ error: "Войдите в студию" }, 401);
      if (scope === "upload" && method === "POST") return json(await saveUpload(req, "agency", 120), 201);
      if (!id && method === "GET")
        return json({ projects: store.listProjects() });
      if (!id && method === "POST")
        return json({ project: store.createProject(await body(req)) }, 201);
      if (id && !action && method === "GET")
        return json({ project: store.project(id) });
      if (id && !action && method === "PATCH") {
        const v = z
          .object({
            version: z.number().int(),
            clientName: z.string(),
            references: z.array(z.string()),
            config: z.unknown(),
          })
          .parse(await body(req));
        return json({
          project: store.updateProject(id, { ...v, config: v.config }),
        });
      }
      if (id && action === "review" && method === "POST")
        return json({
          project: store.requestReview(
            id,
            z.object({ version: z.number().int() }).parse(await body(req))
              .version,
          ),
        });
      if (id && action === "publish" && method === "POST")
        return json({
          project: store.publishProject(
            id,
            z.object({ version: z.number().int() }).parse(await body(req))
              .version,
          ),
        });
      if (id && action === "unpublish" && method === "POST")
        return json({ project: store.unpublishProject(id) });
      if (id && action === "bookings" && method === "GET") {
        store.project(id);
        return json({ bookings: store.bookings(id) });
      }
      if (id && action === "bookings" && method === "PATCH") {
        const v = z
          .object({
            id: z.string(),
            status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
          })
          .parse(await body(req));
        return json({ booking: store.changeBooking(id, v.id, v.status) });
      }
    }
    if (scope === "assets" && id && method === "GET") {
      const row = db()
        .prepare("SELECT type,bytes FROM detail_assets WHERE id=?")
        .get(id) as { type: string; bytes: Uint8Array } | undefined;
      if (!row) return json({ error: "Изображение не найдено" }, 404);
      return new Response(new Uint8Array(row.bytes), {
        headers: {
          "Content-Type": row.type,
          "Cache-Control": "public,max-age=31536000,immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (scope === "reviews" && id) {
      if (method === "GET") {
        const { projectId: _, ...review } = store.review(id);
        return json({ review });
      }
      if (method === "POST") {
        const v = z
          .object({
            decision: z.enum(["approved", "changes"]),
            comment: z.string().max(2000).default(""),
          })
          .parse(await body(req));
        const { projectId: _, ...review } = store.decideReview(
          id,
          v.decision,
          v.comment,
        );
        return json({ review });
      }
    }
    if (scope === "sites" && id && action === "slots" && method === "GET")
      return json({
        slots: store.availableSlots(
          id,
          url.searchParams.get("service") || "",
          url.searchParams.get("date") || "",
        ),
      });
    if (scope === "sites" && id && action === "bookings" && method === "POST") {
      const ip = createHash("sha256")
        .update(req.headers.get("x-real-ip") || "unknown")
        .digest("hex");
      if (!rateLimit("booking:" + id + ":" + ip, 8, 3600))
        return json(
          {
            error:
              "Слишком много заявок. Позвоните в студию или попробуйте позже.",
          },
          429,
        );
      const booking = store.createBooking(id, await body(req));
      return json(
        {
          booking: store.publicBooking(booking),
        },
        201,
      );
    }
    if (scope === "sites" && id && action === "receipt" && method === "POST") {
      const ip = createHash("sha256").update(req.headers.get("x-real-ip") || "unknown").digest("hex");
      if (!rateLimit(`receipt:${ip}`, 60, 600)) return json({error: "Слишком много проверок. Попробуйте позже."}, 429);
      const v = z.object({ submissionToken: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await body(req));
      return json({ booking: store.publicBooking(store.bookingReceipt(id, v.submissionToken)) });
    }
    return json({ error: "Страница не найдена" }, 404);
  } catch (error) {
    if (error instanceof store.DetailError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof SyntaxError)
      return json({ error: "Некорректный запрос" }, 400);
    console.error("Detailing API error", error);
    return json(
      { error: "Не удалось выполнить действие. Попробуйте ещё раз." },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
