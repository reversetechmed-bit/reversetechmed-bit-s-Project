CREATE TABLE `dispensingRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partId` int NOT NULL,
	`requestedById` int NOT NULL,
	`requestedQuantity` int NOT NULL,
	`purpose` text NOT NULL,
	`status` enum('pending','approved','rejected','delivered') NOT NULL DEFAULT 'pending',
	`decisionNote` text,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`deliveredById` int,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dispensingRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partId` int NOT NULL,
	`requestId` int,
	`type` enum('part_created','part_updated','request_submitted','request_approved','request_rejected','delivery_confirmed') NOT NULL,
	`quantityDelta` int NOT NULL DEFAULT 0,
	`quantityBefore` int,
	`quantityAfter` int,
	`actorId` int,
	`engineerId` int,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partNumber` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`category` enum('Medical','Embedded','Electronics','Boards') NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`minimumStock` int NOT NULL DEFAULT 0,
	`location` varchar(160),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parts_id` PRIMARY KEY(`id`),
	CONSTRAINT `parts_partNumber_unique` UNIQUE(`partNumber`)
);
--> statement-breakpoint
CREATE TABLE `warehouseAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('new_request','low_stock') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`partId` int,
	`requestId` int,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouseAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD CONSTRAINT `dispensingRequests_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD CONSTRAINT `dispensingRequests_requestedById_users_id_fk` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD CONSTRAINT `dispensingRequests_reviewedById_users_id_fk` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD CONSTRAINT `dispensingRequests_deliveredById_users_id_fk` FOREIGN KEY (`deliveredById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_requestId_dispensingRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `dispensingRequests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_engineerId_users_id_fk` FOREIGN KEY (`engineerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parts` ADD CONSTRAINT `parts_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_requestId_dispensingRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `dispensingRequests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `dispensingRequests` (`status`);--> statement-breakpoint
CREATE INDEX `requests_requester_idx` ON `dispensingRequests` (`requestedById`);--> statement-breakpoint
CREATE INDEX `requests_part_idx` ON `dispensingRequests` (`partId`);--> statement-breakpoint
CREATE INDEX `transactions_part_idx` ON `inventoryTransactions` (`partId`);--> statement-breakpoint
CREATE INDEX `transactions_request_idx` ON `inventoryTransactions` (`requestId`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `inventoryTransactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `parts_category_idx` ON `parts` (`category`);--> statement-breakpoint
CREATE INDEX `parts_stock_idx` ON `parts` (`quantity`,`minimumStock`);--> statement-breakpoint
CREATE INDEX `alerts_unread_idx` ON `warehouseAlerts` (`isRead`,`createdAt`);