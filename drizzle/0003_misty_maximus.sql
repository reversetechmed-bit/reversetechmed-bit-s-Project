CREATE TABLE `componentTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `componentTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `componentTypes_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `handoverInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(48) NOT NULL,
	`requestId` int NOT NULL,
	`partId` int NOT NULL,
	`issuedById` int,
	`receivedById` int NOT NULL,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`warehouseSectionSnapshot` enum('components','products') NOT NULL,
	`quantity` int NOT NULL,
	`purposeSnapshot` text NOT NULL,
	`issuedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handoverInvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `handoverInvoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`),
	CONSTRAINT `handoverInvoices_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `warehouseActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('inventory_created','inventory_updated','request_submitted','request_approved','request_rejected','handover_completed') NOT NULL,
	`actorId` int,
	`title` varchar(200) NOT NULL,
	`detail` text,
	`requestId` int,
	`partId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouseActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `parts` ADD `componentTypeId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `requestedRole` enum('user','admin') DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `componentTypes` ADD CONSTRAINT `componentTypes_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD CONSTRAINT `handoverInvoices_requestId_dispensingRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `dispensingRequests`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD CONSTRAINT `handoverInvoices_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD CONSTRAINT `handoverInvoices_issuedById_users_id_fk` FOREIGN KEY (`issuedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD CONSTRAINT `handoverInvoices_receivedById_users_id_fk` FOREIGN KEY (`receivedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_requestId_dispensingRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `dispensingRequests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `component_types_active_idx` ON `componentTypes` (`isActive`);--> statement-breakpoint
CREATE INDEX `invoices_issued_at_idx` ON `handoverInvoices` (`issuedAt`);--> statement-breakpoint
CREATE INDEX `warehouse_activity_date_idx` ON `warehouseActivities` (`createdAt`);--> statement-breakpoint
ALTER TABLE `parts` ADD CONSTRAINT `parts_componentTypeId_componentTypes_id_fk` FOREIGN KEY (`componentTypeId`) REFERENCES `componentTypes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `parts_component_type_idx` ON `parts` (`componentTypeId`);