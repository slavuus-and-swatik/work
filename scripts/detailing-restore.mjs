import { DatabaseSync, backup } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) throw new Error("Usage: node scripts/detailing-restore.mjs BACKUP.sqlite NEW_DATA_DIRECTORY");
const sourcePath = resolve(sourceArg), destination = resolve(destinationArg);
if (!existsSync(sourcePath)) throw new Error("Backup file does not exist");
if (existsSync(destination)) throw new Error("Destination must be a new directory; existing data is never overwritten");
const source = new DatabaseSync(sourcePath, {readOnly:true});
let destinationCreated = false;
try {
  if (source.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Backup integrity check failed");
  mkdirSync(destination, {mode:0o700}); destinationCreated = true;
  const target = join(destination, "studio.sqlite");
  await backup(source, target);
  chmodSync(target, 0o600);
  const restored = new DatabaseSync(target, {readOnly:true});
  try {
    if (restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Restored database failed integrity check");
    const projects = restored.prepare("SELECT COUNT(*) AS n FROM detail_projects").get().n;
    const bookings = restored.prepare("SELECT COUNT(*) AS n FROM detail_bookings").get().n;
    console.log(`Restored and verified: ${projects} projects, ${bookings} bookings. Set DETAILING_DATA_DIR=${destination} for an isolated validation server before switching production.`);
  } finally { restored.close(); }
} catch (error) {
  if (destinationCreated) rmSync(destination, {recursive:true,force:true});
  throw error;
} finally { source.close(); }
