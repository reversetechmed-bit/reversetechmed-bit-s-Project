CREATE TABLE `printLabMaterialMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`orderId` int,
	`printerId` int,
	`type` enum('inbound','consumed','returned','adjustment_in','adjustment_out') NOT NULL,
	`gramsDelta` int NOT NULL,
	`gramsBefore` int NOT NULL,
	`gramsAfter` int NOT NULL,
	`reason` text NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `printLabMaterialMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printLabMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`materialType` varchar(80) NOT NULL,
	`color` varchar(80),
	`spoolCode` varchar(80),
	`availableGrams` int NOT NULL DEFAULT 0,
	`minimumGrams` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printLabMaterials_id` PRIMARY KEY(`id`),
	CONSTRAINT `printLabMaterials_spoolCode_unique` UNIQUE(`spoolCode`)
);
--> statement-breakpoint
CREATE TABLE `printLabOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(48) NOT NULL,
	`title` varchar(200) NOT NULL,
	`receivedFrom` varchar(160),
	`deliveredTo` varchar(160),
	`printerId` int,
	`materialId` int,
	`expectedGrams` int NOT NULL DEFAULT 0,
	`actualGramsUsed` int NOT NULL DEFAULT 0,
	`status` enum('received','scheduled','printing','completed','delivered','cancelled') NOT NULL DEFAULT 'received',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`deliveredAt` timestamp,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printLabOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `printLabOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `printLabPrinters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`model` varchar(160),
	`location` varchar(160),
	`status` enum('available','printing','maintenance','offline') NOT NULL DEFAULT 'available',
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printLabPrinters_id` PRIMARY KEY(`id`),
	CONSTRAINT `printLabPrinters_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `printLabRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`printerId` int NOT NULL,
	`orderId` int,
	`materialId` int NOT NULL,
	`gramsUsed` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`notes` text,
	`loggedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `printLabRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `printLabMaterialMovements` ADD CONSTRAINT `printLabMaterialMovements_materialId_printLabMaterials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `printLabMaterials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabMaterialMovements` ADD CONSTRAINT `printLabMaterialMovements_orderId_printLabOrders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `printLabOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabMaterialMovements` ADD CONSTRAINT `printLabMaterialMovements_printerId_printLabPrinters_id_fk` FOREIGN KEY (`printerId`) REFERENCES `printLabPrinters`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabMaterialMovements` ADD CONSTRAINT `printLabMaterialMovements_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabMaterials` ADD CONSTRAINT `printLabMaterials_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabOrders` ADD CONSTRAINT `printLabOrders_printerId_printLabPrinters_id_fk` FOREIGN KEY (`printerId`) REFERENCES `printLabPrinters`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabOrders` ADD CONSTRAINT `printLabOrders_materialId_printLabMaterials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `printLabMaterials`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabOrders` ADD CONSTRAINT `printLabOrders_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabPrinters` ADD CONSTRAINT `printLabPrinters_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabRuns` ADD CONSTRAINT `printLabRuns_printerId_printLabPrinters_id_fk` FOREIGN KEY (`printerId`) REFERENCES `printLabPrinters`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabRuns` ADD CONSTRAINT `printLabRuns_orderId_printLabOrders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `printLabOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabRuns` ADD CONSTRAINT `printLabRuns_materialId_printLabMaterials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `printLabMaterials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `printLabRuns` ADD CONSTRAINT `printLabRuns_loggedById_users_id_fk` FOREIGN KEY (`loggedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `print_lab_movements_material_date_idx` ON `printLabMaterialMovements` (`materialId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `print_lab_movements_order_idx` ON `printLabMaterialMovements` (`orderId`);--> statement-breakpoint
CREATE INDEX `print_lab_movements_printer_idx` ON `printLabMaterialMovements` (`printerId`);--> statement-breakpoint
CREATE INDEX `print_lab_materials_active_idx` ON `printLabMaterials` (`isActive`);--> statement-breakpoint
CREATE INDEX `print_lab_materials_stock_idx` ON `printLabMaterials` (`availableGrams`,`minimumGrams`);--> statement-breakpoint
CREATE INDEX `print_lab_orders_status_idx` ON `printLabOrders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `print_lab_orders_printer_idx` ON `printLabOrders` (`printerId`,`status`);--> statement-breakpoint
CREATE INDEX `print_lab_orders_material_idx` ON `printLabOrders` (`materialId`);--> statement-breakpoint
CREATE INDEX `print_lab_printers_status_idx` ON `printLabPrinters` (`status`);--> statement-breakpoint
CREATE INDEX `print_lab_runs_printer_date_idx` ON `printLabRuns` (`printerId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `print_lab_runs_order_idx` ON `printLabRuns` (`orderId`);--> statement-breakpoint
CREATE INDEX `print_lab_runs_material_idx` ON `printLabRuns` (`materialId`);