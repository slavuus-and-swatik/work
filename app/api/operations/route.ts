import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { backupStatus, createBackup, databaseReady, latestBackupPath } from "@/lib/detailing/backup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function GET(req: Request) {
  if (!isPlatformAdmin(req)) return Response.json({ error: "Войдите в студию" }, { status: 401, headers });
  try {
    if (new URL(req.url).searchParams.get("download") === "latest") {
      const copy = latestBackupPath();
      if (!copy) return Response.json({ error: "Проверенных копий пока нет" }, {status: 404, headers});
      return new Response(Readable.toWeb(createReadStream(copy.path)) as ReadableStream, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${copy.name}"`, "Content-Length": String(copy.bytes) } });
    }
    databaseReady();
    return Response.json({ database: "ready", backup: backupStatus() }, { headers });
  } catch (error) {
    console.error("Operations check failed", error);
    return Response.json({ error: "Не удалось проверить хранилище" }, {status: 503, headers});
  }
}
export async function POST(req: Request) {
  if (!isPlatformAdmin(req)) return Response.json({ error: "Войдите в студию" }, { status: 401, headers });
  const origin = req.headers.get("origin");
  if (origin && origin !== (process.env.APP_ORIGIN || new URL(req.url).origin)) return Response.json({error: "Недопустимый источник запроса"}, {status:403,headers});
  try { return Response.json({ database: "ready", backup: await createBackup() }, { headers }); }
  catch { return Response.json({error: "Резервная копия не создана. Проверьте место и состояние хранилища."}, {status:503,headers}); }
}
