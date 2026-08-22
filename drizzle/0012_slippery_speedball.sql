ALTER TABLE `employeeProfiles` ADD `initialPasswordHash` varchar(128);--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD `initialPasswordHash` varchar(128);--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD `initialPasswordIssuedAt` timestamp;--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD `suspendedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `employeeProfiles` ADD `accessRevokedAt` timestamp;--> statement-breakpoint
CREATE INDEX `employees_suspension_idx` ON `employeeProfiles` (`suspendedUntil`);
