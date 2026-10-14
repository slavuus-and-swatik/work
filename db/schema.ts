import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  slug: text('slug').primaryKey(),
  ownerId: text('owner_id'),
  draft: text('draft').notNull(),
  published: text('published').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  tenantSlug: text('tenant_slug').notNull(),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull(),
  wheelSize: integer('wheel_size').notNull(),
  vehicleType: text('vehicle_type').notNull(),
  addOns: text('add_ons').notNull(),
  price: integer('price').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  post: integer('post').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  status: text('status').notNull(),
  cancelToken: text('cancel_token').notNull(),
  createdAt: text('created_at').notNull(),
});
