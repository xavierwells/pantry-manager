CREATE TABLE `recipe_books` (
	`user_id` text PRIMARY KEY NOT NULL,
	`recipes_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
