CREATE TABLE `grocery_lists` (
	`user_id` text PRIMARY KEY NOT NULL,
	`items_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
