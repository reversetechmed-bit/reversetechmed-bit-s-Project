ALTER TABLE `maintenanceCases` MODIFY COLUMN `status` enum('open','sent_for_maintenance','awaiting_inspection','under_diagnosis','repair_in_progress','quality_check','returned_to_stock','closed','cancelled') NOT NULL DEFAULT 'open';--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `assetSerialNumber` varchar(160);--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `externalServiceProvider` varchar(200);--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `externalReference` varchar(160);--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `priority` enum('low','normal','high','urgent') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `diagnosis` text;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `resolutionNote` text;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `disposition` enum('return_to_stock','return_to_customer','cannibalize','scrap');--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `estimatedCost` int;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `actualCost` int;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD `resolvedAt` timestamp;