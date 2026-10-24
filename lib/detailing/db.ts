import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

let connection: DatabaseSync | undefined;
export const dataDirectory = () =>
  resolve(
    /* turbopackIgnore: true */ process.env.DETAILING_DATA_DIR ||
      "./data/detailing",
  );
export function db() {
  if (connection) return connection;
  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const candidate = new DatabaseSync(join(dataDirectory(), "studio.sqlite"));
  try {
    candidate.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS detail_projects(id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_reviews(token TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_sites(project_id TEXT PRIMARY KEY REFERENCES detail_projects(id), config TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_bookings(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), date TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS detail_booking_day ON detail_bookings(project_id,date);
    CREATE TABLE IF NOT EXISTS detail_booking_events(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), booking_id TEXT NOT NULL REFERENCES detail_bookings(id), data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS detail_booking_events_lookup ON detail_booking_events(project_id,booking_id);
    CREATE TABLE IF NOT EXISTS detail_booking_receipts(project_id TEXT NOT NULL REFERENCES detail_projects(id), token_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, booking_id TEXT NOT NULL REFERENCES detail_bookings(id), PRIMARY KEY(project_id,token_hash));
    CREATE TABLE IF NOT EXISTS detail_telegram_connections(project_id TEXT PRIMARY KEY REFERENCES detail_projects(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_notification_outbox(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), booking_id TEXT NOT NULL REFERENCES detail_bookings(id), revision TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, sent_at TEXT, message_id INTEGER, UNIQUE(booking_id,revision));
    CREATE INDEX IF NOT EXISTS detail_notification_due ON detail_notification_outbox(state,next_at,lease_until);
    CREATE INDEX IF NOT EXISTS detail_notification_project ON detail_notification_outbox(project_id,created_at);
    CREATE TABLE IF NOT EXISTS detail_health(id INTEGER PRIMARY KEY CHECK(id=1), checked_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_assets(id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_client_access(project_id TEXT PRIMARY KEY REFERENCES detail_projects(id), password_hash TEXT, invite_hash TEXT, invite_expires INTEGER);
    CREATE TABLE IF NOT EXISTS detail_client_sessions(token_hash TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS detail_client_sessions_project ON detail_client_sessions(project_id);
  `);
  } catch (error) {
    candidate.close();
    throw error;
  }
  connection = candidate;
  return connection;
}
export function transaction<T>(fn: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
// Persistent counters work across server restarts and separate Node processes.
export function rateLimit(key: string, limit: number, seconds: number) {
  return transaction(() => {
    const now = Date.now();
    db().prepare("DELETE FROM detail_limits WHERE until < ?").run(now);
    const row = db()
      .prepare("SELECT count,until FROM detail_limits WHERE key=?")
      .get(key) as { count: number; until: number } | undefined;
    if (row && row.count >= limit) return false;
    db()
      .prepare(
        "INSERT INTO detail_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      )
      .run(key, 1, now + seconds * 1000);
    return true;
  });
}
