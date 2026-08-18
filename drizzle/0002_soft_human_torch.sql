CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(32) NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_name_unique` UNIQUE(`name`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `employeeProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`employeeCode` varchar(64) NOT NULL,
	`jobTitle` varchar(160) NOT NULL,
	`departmentId` int,
	`warehouseRole` enum('admin','engineer','viewer') NOT NULL DEFAULT 'engineer',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `employeeProfiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `employeeProfiles_email_unique` UNIQUE(`email`),
	CONSTRAINT `employeeProfiles_employeeCode_unique` UNIQUE(`employeeCode`)
);
--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `warehouseSectionSnapshot` enum('components','products') DEFAULT 'components' NOT NULL;--> statement-breakpoint
ALTER TABLE `parts` ADD `warehouseSection` enum('components','products') DEFAULT 'components' NOT NULL;--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD CONSTRAINT `employeeProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD CONSTRAINT `employeeProfiles_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `departments_active_idx` ON `departments` (`isActive`);--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employeeProfiles` (`departmentId`);--> statement-breakpoint
CREATE INDEX `employees_active_idx` ON `employeeProfiles` (`isActive`);--> statement-breakpoint
CREATE INDEX `parts_section_idx` ON `parts` (`warehouseSection`);