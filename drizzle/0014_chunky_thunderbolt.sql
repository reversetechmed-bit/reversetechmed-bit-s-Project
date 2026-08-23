CREATE TABLE `custodyAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`custodyNumber` varchar(48) NOT NULL,
	`requestId` int NOT NULL,
	`partId` int NOT NULL,
	`holderId` int NOT NULL,
	`issuedById` int,
	`returnedById` int,
	`quantity` int NOT NULL,
	`purpose` text NOT NULL,
	`dueAt` timestamp,
	`status` enum('active','returned','cancelled') NOT NULL DEFAULT 'active',
	`issuedAt` timestamp NOT NULL,
	`returnedAt` timestamp,
	`issueNote` text,
	`returnNote` text,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`warehouseSectionSnapshot` enum('components','products') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custodyAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `custodyAssignments_custodyNumber_unique` UNIQUE(`custodyNumber`),
	CONSTRAINT `custodyAssignments_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
ALTER TABLE `inventoryTransactions` MODIFY COLUMN `type` enum('part_created','part_updated','request_submitted','request_approved','request_rejected','delivery_confirmed','custody_issued','custody_returned','maintenance_dispatched','maintenance_returned','purchase_received','assembly_consumed','assembly_produced') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseActivities` MODIFY COLUMN `type` enum('inventory_created','inventory_updated','request_submitted','request_approved','request_rejected','handover_completed','handover_receipt_confirmed','custody_issued','custody_returned','maintenance_dispatched','maintenance_returned','purchase_order_created','purchase_received','assembly_completed') NOT NULL;--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD `fulfillmentType` enum('dispense','custody') DEFAULT 'dispense' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `custodyAssignmentId` int;--> statement-breakpoint
ALTER TABLE `parts` ADD `custodyQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `custodyAssignmentId` int;--> statement-breakpoint
ALTER TABLE `custodyAssignments` ADD CONSTRAINT `custodyAssignments_requestId_dispensingRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `dispensingRequests`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custodyAssignments` ADD CONSTRAINT `custodyAssignments_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custodyAssignments` ADD CONSTRAINT `custodyAssignments_holderId_users_id_fk` FOREIGN KEY (`holderId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custodyAssignments` ADD CONSTRAINT `custodyAssignments_issuedById_users_id_fk` FOREIGN KEY (`issuedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custodyAssignments` ADD CONSTRAINT `custodyAssignments_returnedById_users_id_fk` FOREIGN KEY (`returnedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `custody_holder_status_idx` ON `custodyAssignments` (`holderId`,`status`);--> statement-breakpoint
CREATE INDEX `custody_part_status_idx` ON `custodyAssignments` (`partId`,`status`);--> statement-breakpoint
CREATE INDEX `custody_due_idx` ON `custodyAssignments` (`status`,`dueAt`);--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inv_tx_custody_fk` FOREIGN KEY (`custodyAssignmentId`) REFERENCES `custodyAssignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `wh_act_custody_fk` FOREIGN KEY (`custodyAssignmentId`) REFERENCES `custodyAssignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `transactions_custody_idx` ON `inventoryTransactions` (`custodyAssignmentId`);
