import { Pool, type QueryResult } from 'pg';

type PgGlobal = typeof globalThis & {
  __shinslotPgPool?: Pool;
  __shinslotPgSchemaReady?: Promise<void>;
};

const ddl = `
CREATE TABLE IF NOT EXISTS tenants (
  slug TEXT PRIMARY KEY, owner_id TEXT, draft TEXT NOT NULL, published TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
  service_id TEXT NOT NULL, service_name TEXT NOT NULL, wheel_size INTEGER NOT NULL DEFAULT 0,
  vehicle_type TEXT NOT NULL DEFAULT '', add_ons TEXT NOT NULL DEFAULT '[]', price DOUBLE PRECISION NOT NULL,
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, post INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  status TEXT NOT NULL, cancel_token TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_tenant_starts_idx ON bookings (tenant_slug, starts_at);
CREATE INDEX IF NOT EXISTS bookings_customer_token_idx ON bookings (id, tenant_slug, cancel_token);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
  items_json TEXT NOT NULL, total DOUBLE PRECISION NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
  customer_email TEXT, delivery_type TEXT NOT NULL, delivery_address TEXT, delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION, subtotal DOUBLE PRECISION NOT NULL, discount DOUBLE PRECISION NOT NULL,
  delivery_cost DOUBLE PRECISION NOT NULL, rejection_reason TEXT, customer_access_token TEXT NOT NULL,
  payment_method TEXT NOT NULL, payment_status TEXT NOT NULL, status TEXT NOT NULL, comment TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON orders (tenant_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_token_idx ON orders (id, customer_access_token);
CREATE TABLE IF NOT EXISTS media_objects (
  object_key TEXT PRIMARY KEY, body BYTEA NOT NULL, content_type TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production. Configure PostgreSQL before starting the site.');
    }
    return null;
  }
  const state = globalThis as PgGlobal;
  if (!state.__shinslotPgPool) {
    state.__shinslotPgPool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  return state.__shinslotPgPool;
}

export async function ensurePostgresSchema() {
  const pool = getPostgresPool();
  if (!pool) return;
  const state = globalThis as PgGlobal;
  if (!state.__shinslotPgSchemaReady) {
    state.__shinslotPgSchemaReady = pool.query(ddl).then(() => undefined).catch((error) => {
      state.__shinslotPgSchemaReady = undefined;
      throw error;
    });
  }
  await state.__shinslotPgSchemaReady;
}

function postgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

type BoundStatement = {
  bind: (...values: unknown[]) => BoundStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};

export function postgresDatabase() {
  const pool = getPostgresPool();
  if (!pool) return null;
  return {
    prepare(sql: string): BoundStatement {
      let values: unknown[] = [];
      const runQuery = async (): Promise<QueryResult> => {
        await ensurePostgresSchema();
        return pool.query(postgresPlaceholders(sql), values as never[]);
      };
      const statement: BoundStatement = {
        bind(...params) { values = params; return statement; },
        async first<T>() { const result = await runQuery(); return (result.rows[0] as T | undefined) ?? null; },
        async all<T>() { const result = await runQuery(); return { results: result.rows as T[] }; },
        async run() { const result = await runQuery(); return { meta: { changes: result.rowCount || 0 } }; },
      };
      return statement;
    },
  };
}
