CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`code` varchar(48) NOT NULL,
	`contactName` varchar(160),
	`contactPhone` varchar(48),
	`contactEmail` varchar(320),
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_name_unique` UNIQUE(`name`),
	CONSTRAINT `companies_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `productComponents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`componentId` int NOT NULL,
	`quantityRequired` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productComponents_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_components_unique_idx` UNIQUE(`productId`,`componentId`)
);
--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD `recipientName` varchar(160);--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD `recipientDepartment` varchar(160);--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD `projectReference` varchar(160);--> statement-breakpoint
ALTER TABLE `dispensingRequests` ADD `requestNote` text;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `requesterNameSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `recipientNameSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `recipientDepartmentSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `projectReferenceSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `requestNoteSnapshot` text;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `deliveryNote` text;--> statement-breakpoint
ALTER TABLE `parts` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `parts` ADD `productStage` enum('finished','work_in_progress');--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productComponents` ADD CONSTRAINT `productComponents_productId_parts_id_fk` FOREIGN KEY (`productId`) REFERENCES `parts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productComponents` ADD CONSTRAINT `productComponents_componentId_parts_id_fk` FOREIGN KEY (`componentId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `companies_active_name_idx` ON `companies` (`isActive`,`name`);--> statement-breakpoint
CREATE INDEX `product_components_component_idx` ON `productComponents` (`componentId`);--> statement-breakpoint
ALTER TABLE `parts` ADD CONSTRAINT `parts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `parts_company_idx` ON `parts` (`companyId`);