CREATE TABLE `employeeEnrollmentPasscodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`issuedById` int,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeEnrollmentPasscodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `employeeEnrollmentPasscodes_employeeId_unique` UNIQUE(`employeeId`)
);
--> statement-breakpoint
ALTER TABLE `parts` MODIFY COLUMN `productStage` enum('work_in_progress','under_review','under_maintenance','finished','final_operational');--> statement-breakpoint
ALTER TABLE `employeeEnrollmentPasscodes` ADD CONSTRAINT `employeeEnrollmentPasscodes_employeeId_employeeProfiles_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employeeProfiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeEnrollmentPasscodes` ADD CONSTRAINT `employeeEnrollmentPasscodes_issuedById_users_id_fk` FOREIGN KEY (`issuedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `employee_passcodes_expiry_idx` ON `employeeEnrollmentPasscodes` (`expiresAt`);