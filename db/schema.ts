import { customType, doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const tenants = pgTable('tenants', {
  slug: text('slug').primaryKey(),
  ownerId: text('owner_id'),
  draft: text('draft').notNull(),
  published: text('published').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  tenantSlug: text('tenant_slug').notNull().references(() => tenants.slug, { onDelete: 'cascade' }),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull(),
  wheelSize: integer('wheel_size').notNull(),
  vehicleType: text('vehicle_type').notNull(),
  addOns: text('add_ons').notNull(),
  price: doublePrecision('price').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  post: integer('post').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  status: text('status').notNull(),
  cancelToken: text('cancel_token').notNull(),
  createdAt: text('created_at').notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  tenantSlug: text('tenant_slug').notNull().references(() => tenants.slug, { onDelete: 'cascade' }),
  itemsJson: text('items_json').notNull(),
  total: doublePrecision('total').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email'),
  deliveryType: text('delivery_type').notNull(),
  deliveryAddress: text('delivery_address'),
  deliveryLatitude: doublePrecision('delivery_latitude'),
  deliveryLongitude: doublePrecision('delivery_longitude'),
  subtotal: doublePrecision('subtotal').notNull(),
  discount: doublePrecision('discount').notNull(),
  deliveryCost: doublePrecision('delivery_cost').notNull(),
  rejectionReason: text('rejection_reason'),
  customerAccessToken: text('customer_access_token').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentStatus: text('payment_status').notNull(),
  status: text('status').notNull(),
  comment: text('comment'),
  createdAt: text('created_at').notNull(),
});

export const mediaObjects = pgTable('media_objects', {
  objectKey: text('object_key').primaryKey(),
  body: bytea('body').notNull(),
  contentType: text('content_type').notNull(),
  updatedAt: text('updated_at').notNull(),
});
