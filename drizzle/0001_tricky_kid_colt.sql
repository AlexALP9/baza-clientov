CREATE TABLE `login_attempts` (
	`ip_key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_expiry` ON `login_attempts` (`expires_at`);