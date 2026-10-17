import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const localEnv = await readFile(resolve(process.cwd(), '.env'), 'utf8').catch(() => '');
for (const line of localEnv.split(/\r?\n/)) {
  const entry = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!entry || process.env[entry[1]] !== undefined) continue;
  let value = entry[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const quote = value[0];
    value = value.slice(1, -1);
    if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }
  process.env[entry[1]] = value;
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Set it in .env before running migrations.');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const migration = await readFile(resolve(process.cwd(), 'db/migrations/0001_initial.sql'), 'utf8');
    await pool.query(migration);
    console.log('PostgreSQL schema is up to date.');
  } finally {
    await pool.end();
  }
}
