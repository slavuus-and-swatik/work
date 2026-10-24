import { backup, DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDirectory, db, transaction } from "./db";

const INTERVAL = 6 * 60 * 60 * 1000;
const KEEP = 6;
const NAME = /^studio-[\dT-]+-[a-f0-9-]{36}\.sqlite$/;
let running: Promise<ReturnType<typeof backupStatus>> | undefined;
let lastError: string | null = null;
const directory = () => join(dataDirectory(), "backups");
function snapshots() {
  if (!existsSync(directory())) return [];
  return readdirSync(directory()).filter((name) => NAME.test(name)).map((name) => {
    const stat = statSync(join(directory(), name));
    return { name, bytes: stat.size, createdAt: stat.mtime.toISOString() };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function databaseReady() {
  transaction(() => {
    db().prepare("INSERT INTO detail_health VALUES(1,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at").run(Date.now());
    if (!db().prepare("SELECT checked_at FROM detail_health WHERE id=1").get()) throw new Error("Database check failed");
  });
}
export function backupStatus() {
  const copies = snapshots();
  const latest = copies[0] || null;
  const fs = statfsSync(dataDirectory());
  let savedError = lastError;
  try { savedError = JSON.parse(readFileSync(join(directory(), "status.json"), "utf8")).lastError; } catch {}
  return { latest, copies: copies.length, stale: !latest || Date.now() - new Date(latest.createdAt).getTime() > INTERVAL * 2, lastError: savedError, freeBytes: fs.bavail * fs.bsize, intervalHours: 6, offsiteConfigured: false };
}
export function latestBackupPath() {
  const latest = snapshots()[0];
  return latest ? { ...latest, path: join(directory(), latest.name) } : null;
}
export async function createBackup() {
  if (running) return running;
  running = (async () => {
    db();
    mkdirSync(directory(), { recursive: true, mode: 0o700 });
    const name = `studio-${new Date().toISOString().replace(/[:.Z]/g, "-")}-${randomUUID()}.sqlite`;
    const temporary = join(directory(), name + ".partial");
    try {
      const sourceBytes = statSync(join(dataDirectory(), "studio.sqlite")).size + (existsSync(join(dataDirectory(), "studio.sqlite-wal")) ? statSync(join(dataDirectory(), "studio.sqlite-wal")).size : 0);
      const fs = statfsSync(dataDirectory());
      if (fs.bavail * fs.bsize < sourceBytes * 2 + 64 * 1024 * 1024) throw new Error("Недостаточно свободного места для резервной копии");
      await backup(db(), temporary);
      chmodSync(temporary, 0o600);
      const copy = new DatabaseSync(temporary, { readOnly: true });
      try {
        const check = copy.prepare("PRAGMA integrity_check").get() as {integrity_check: string};
        if (check.integrity_check !== "ok") throw new Error("Проверка резервной копии не пройдена");
      } finally { copy.close(); }
      renameSync(temporary, join(directory(), name));
      for (const old of snapshots().slice(KEEP)) unlinkSync(join(directory(), old.name));
      lastError = null;
      writeFileSync(join(directory(), "status.json"), JSON.stringify({ lastError: null }), {mode: 0o600});
      return backupStatus();
    } catch (error) {
      lastError = error instanceof Error && error.message.startsWith("Недостаточно") ? error.message : "Не удалось создать проверенную резервную копию";
      try { writeFileSync(join(directory(), "status.json"), JSON.stringify({lastError}), {mode: 0o600}); } catch {}
      if (existsSync(temporary)) unlinkSync(temporary);
      console.error("Detailing backup failed", error);
      throw error;
    }
  })();
  try { return await running; } finally { running = undefined; }
}
export function startBackups() {
  const state = globalThis as typeof globalThis & { detailingBackupsStarted?: boolean };
  if (state.detailingBackupsStarted || process.env.DETAILING_BACKUPS === "off") return;
  state.detailingBackupsStarted = true;
  const run = () => { void createBackup().catch(() => {}); };
  setTimeout(run, 30_000).unref();
  setInterval(run, INTERVAL).unref();
}
