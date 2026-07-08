CREATE TABLE `ai_models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text DEFAULT 'cloudflare' NOT NULL,
	`model_id` text NOT NULL,
	`base_url` text,
	`api_key` text,
	`capabilities` text DEFAULT 'text' NOT NULL,
	`is_default_text` integer DEFAULT 0 NOT NULL,
	`is_default_image` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `ai_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`content` text NOT NULL,
	`model_id` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_prompts_model_id_idx` ON `ai_prompts` (`model_id`);
