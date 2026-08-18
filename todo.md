# Project TODO

- [x] Define inventory, dispensing request, transaction, and notification data models with the four required categories: Medical (طبي), Embedded (إمبيديد), Electronics (إلكترونيات), and Boards (لوحات).
- [x] Enforce Admin and Engineer permissions across all protected workflows and views.
- [x] Build the polished dashboard shell, responsive navigation, Arabic/English category presentation, and role-aware home views.
- [x] Implement Admin inventory management: create, edit, search, filter, and delete parts with quantity, category, description, and minimum stock threshold.
- [x] Implement Engineer part discovery and dispensing request form with requested quantity and purpose.
- [x] Send an owner notification immediately whenever an Engineer submits a dispensing request.
- [x] Implement Admin request queue with approval and rejection actions, request status, and decision metadata.
- [x] Implement delivery confirmation that atomically deducts delivered quantity from inventory without a separate manual inventory update.
- [x] Record an immutable transaction history for requests, approvals, rejections, and deliveries, including date, engineer name, part name/details, and quantities.
- [x] Display actionable low-stock warnings whenever available quantity is below a part's defined minimum threshold.
- [x] Write and run Vitest coverage for permissions, approval/delivery stock rules, transaction logging, and low-stock detection.
- [x] Verify core desktop and mobile layouts, inspect runtime logs, and save the final project checkpoint.
- [x] Add UI support to capture and display request decision metadata, including an optional rejection note and review timestamp.
- [x] Add Vitest coverage for procedure-level permissions and transactional delivery, transaction recording, and low-stock alert behavior.
- [ ] Save the verified final webdev project checkpoint.
- [x] Test the delivery service used by the router to verify inventory deduction, transaction insertion, and low-stock alert creation together.
