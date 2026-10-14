CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_slug` text NOT NULL,
	`service_id` text NOT NULL,
	`service_name` text NOT NULL,
	`wheel_size` integer NOT NULL,
	`vehicle_type` text NOT NULL,
	`add_ons` text NOT NULL,
	`price` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`post` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`status` text NOT NULL,
	`cancel_token` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`slug` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`draft` text NOT NULL,
	`published` text NOT NULL,
	`updated_at` text NOT NULL
);
