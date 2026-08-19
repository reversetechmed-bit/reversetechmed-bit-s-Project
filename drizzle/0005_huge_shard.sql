ALTER TABLE `warehouseActivities` MODIFY COLUMN `type` enum('inventory_created','inventory_updated','request_submitted','request_approved','request_rejected','handover_completed','handover_receipt_confirmed') NOT NULL;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `receiptConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `receiptConfirmationName` varchar(160);--> statement-breakpoint
ALTER TABLE `handoverInvoices` ADD `receiptNote` text;--> statement-breakpoint
ALTER TABLE `parts` ADD `reservedQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `parts` ADD `storageShelf` varchar(80);--> statement-breakpoint
ALTER TABLE `parts` ADD `storageDrawer` varchar(80);--> statement-breakpoint
ALTER TABLE `parts` ADD `storageBox` varchar(80);--> statement-breakpoint
ALTER TABLE `parts` ADD `imageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `parts` ADD `specifications` text;