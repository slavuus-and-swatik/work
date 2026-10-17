CREATE TABLE IF NOT EXISTS tenants (
  slug TEXT PRIMARY KEY,
  owner_id TEXT,
  draft TEXT NOT NULL,
  published TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  wheel_size INTEGER NOT NULL DEFAULT 0,
  vehicle_type TEXT NOT NULL DEFAULT '',
  add_ons TEXT NOT NULL DEFAULT '[]',
  price DOUBLE PRECISION NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  post INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL,
  cancel_token TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bookings_tenant_starts_idx ON bookings (tenant_slug, starts_at);
CREATE INDEX IF NOT EXISTS bookings_customer_token_idx ON bookings (id, tenant_slug, cancel_token);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
  items_json TEXT NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  delivery_type TEXT NOT NULL,
  delivery_address TEXT,
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  subtotal DOUBLE PRECISION NOT NULL,
  discount DOUBLE PRECISION NOT NULL,
  delivery_cost DOUBLE PRECISION NOT NULL,
  rejection_reason TEXT,
  customer_access_token TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  status TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON orders (tenant_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_token_idx ON orders (id, customer_access_token);

CREATE TABLE IF NOT EXISTS media_objects (
  object_key TEXT PRIMARY KEY,
  body BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
