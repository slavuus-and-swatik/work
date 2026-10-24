import { databaseReady } from "@/lib/detailing/backup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    databaseReady();
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Database readiness failed", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
