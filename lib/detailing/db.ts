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
  connection = new DatabaseSync(join(dataDirectory(), "studio.sqlite"));
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS detail_projects(id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_reviews(token TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_sites(project_id TEXT PRIMARY KEY REFERENCES detail_projects(id), config TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_bookings(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES detail_projects(id), date TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS detail_booking_day ON detail_bookings(project_id,date);
    CREATE TABLE IF NOT EXISTS detail_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS detail_assets(id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL);
  `);
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
