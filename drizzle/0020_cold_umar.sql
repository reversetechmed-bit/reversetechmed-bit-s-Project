ALTER TABLE `workOrders` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_dept_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `work_orders_department_idx` ON `workOrders` (`departmentId`,`status`);
