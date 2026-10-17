import { loadEnvConfig } from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

loadEnvConfig(process.cwd());

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
