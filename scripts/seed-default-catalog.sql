-- Idempotent operational starter catalog. Existing user data and quantities are never overwritten.
INSERT INTO `inventoryCategories` (`name`, `description`, `colorKey`, `isActive`) VALUES
  ('Medical', 'أصناف وأجهزة للاستخدام الطبي', 'rose', 1),
  ('Embedded', 'لوحات متحكمات وأنظمة مدمجة', 'blue', 1),
  ('Electronics', 'مكونات ودوائر إلكترونية', 'violet', 1),
  ('Boards', 'لوحات إلكترونية ومنتجات تحت التشغيل', 'emerald', 1)
ON DUPLICATE KEY UPDATE `isActive` = 1;

INSERT INTO `componentTypes` (`name`, `description`, `isActive`) VALUES
  ('إلكترونيات وتحكم', 'متحكمات وشاشات ولوحات وقطع إلكترونية', 1),
  ('بصريات طبية', 'مصادر ضوء وملحقات علاج ضوئي', 1),
  ('طاقة وتوصيلات', 'مصادر طاقة وكابلات ومفاتيح', 1),
  ('هيكل وتجميع', 'هياكل ومراوح ومثبتات ميكانيكية', 1),
  ('مستهلكات صيانة', 'مواد تنظيف ولصق وتجهيز', 1)
ON DUPLICATE KEY UPDATE `isActive` = 1;

INSERT INTO `companies` (`name`, `code`, `notes`, `isActive`) VALUES
  ('REVERSE TECH', 'RT-CORE', 'الكيان الداخلي الافتراضي لتصميم وتجميع المنتجات واللوحات.', 1),
  ('Target', 'TARGET', 'شركة منتجات أجهزة طبية؛ تتضمن إصدارات جهاز الفوتوثيرابي.', 1)
ON DUPLICATE KEY UPDATE `isActive` = 1;

INSERT INTO `storageLocations` (`code`, `name`, `barcode`, `shelf`, `drawer`, `box`, `notes`, `isActive`) VALUES
  ('RT-COMP-A01', 'رف المكونات الإلكترونية', 'RTWMS-LOC-COMP-A01', 'A', '01', 'إلكترونيات', 'موقع افتراضي للمكونات الإلكترونية والطبية.', 1),
  ('RT-MED-B01', 'رف التجميع الطبي', 'RTWMS-LOC-MED-B01', 'B', '01', 'تجميع', 'موقع افتراضي للمنتجات والأجهزة تحت التجميع.', 1),
  ('RT-PROD-C01', 'رف المنتجات النهائية', 'RTWMS-LOC-PROD-C01', 'C', '01', 'أجهزة', 'موقع افتراضي للأجهزة الطبية الجاهزة.', 1)
ON DUPLICATE KEY UPDATE `isActive` = 1;

INSERT INTO `parts` (`partNumber`, `name`, `description`, `category`, `categoryId`, `warehouseSection`, `componentTypeId`, `companyId`, `productStage`, `quantity`, `reservedQuantity`, `custodyQuantity`, `minimumStock`, `location`, `storageShelf`, `storageDrawer`, `storageBox`, `barcode`, `serialTrackingMode`) VALUES
  ('RT-CMP-LED-455', 'LED علاجي أزرق 455nm', 'مصدر ضوء علاجي لجهاز الفوتوثيرابي.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'بصريات طبية'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 120, 0, 0, 20, 'رف المكونات الإلكترونية', 'A', '01', 'LED', 'RTWMS-LED-455', 'none'),
  ('RT-CMP-MCU-STM32F103', 'متحكم STM32F103C8T6', 'متحكم دقيق للوحات التحكم الطبية والمضمنة.', 'Embedded', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Embedded'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'إلكترونيات وتحكم'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 80, 0, 0, 15, 'رف المكونات الإلكترونية', 'A', '01', 'MCU', 'RTWMS-MCU-F103', 'none'),
  ('RT-CMP-PCB-PHOTO-CTRL', 'PCB تحكم فوتوثيرابي', 'لوحة PCB خامة مخصصة لوحدة التحكم في العلاج الضوئي.', 'Boards', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Boards'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'إلكترونيات وتحكم'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 30, 0, 0, 8, 'رف المكونات الإلكترونية', 'A', '02', 'PCB', 'RTWMS-PCB-PHOTO', 'none'),
  ('RT-CMP-OLED-12864', 'شاشة OLED 1.3 بوصة', 'شاشة معلومات صغيرة لواجهة الجهاز.', 'Electronics', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Electronics'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'إلكترونيات وتحكم'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 35, 0, 0, 8, 'رف المكونات الإلكترونية', 'A', '03', 'Display', 'RTWMS-OLED-12864', 'none'),
  ('RT-CMP-PSU-24V-5A', 'مزود طاقة طبي 24V 5A', 'مزود طاقة معزول مناسب لتغذية جهاز الفوتوثيرابي.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'طاقة وتوصيلات'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 24, 0, 0, 6, 'رف المكونات الإلكترونية', 'A', '04', 'Power', 'RTWMS-PSU-24V5A', 'none'),
  ('RT-CMP-FAN-12V-80', 'مروحة تبريد 12V 80mm', 'مروحة تبريد للتجميعات الطبية.', 'Electronics', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Electronics'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'هيكل وتجميع'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 40, 0, 0, 10, 'رف المكونات الإلكترونية', 'A', '05', 'Cooling', 'RTWMS-FAN-12V80', 'none'),
  ('RT-CMP-FOOTSWITCH', 'مفتاح قدم طبي', 'مفتاح تشغيل قدم للاستخدام مع أجهزة العلاج.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'طاقة وتوصيلات'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 20, 0, 0, 5, 'رف المكونات الإلكترونية', 'A', '06', 'Switches', 'RTWMS-FOOTSWITCH', 'none'),
  ('RT-CMP-CABLE-MED-2M', 'كابل طبي 2 متر', 'كابل توصيل محمي للاستخدام الطبي.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'طاقة وتوصيلات'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 30, 0, 0, 8, 'رف المكونات الإلكترونية', 'A', '07', 'Cables', 'RTWMS-CABLE-MED2M', 'none'),
  ('RT-CMP-ENCLOSURE-PHOTO', 'هيكل جهاز فوتوثيرابي', 'هيكل معدني مطلي لتجميع جهاز العلاج الضوئي.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'هيكل وتجميع'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 18, 0, 0, 5, 'رف التجميع الطبي', 'B', '01', 'Enclosures', 'RTWMS-ENC-PHOTO', 'none'),
  ('RT-CMP-SCREW-M3', 'طقم مسامير M3', 'طقم تثبيت للتجميعات والألواح.', 'Electronics', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Electronics'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'هيكل وتجميع'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 500, 0, 0, 80, 'رف المكونات الإلكترونية', 'A', '08', 'Fasteners', 'RTWMS-SCREW-M3', 'none'),
  ('RT-CMP-IPA-70', 'كحول آيزوبروبانول 70%', 'مستهلك صيانة وتنظيف للوحات الإلكترونية.', 'Electronics', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Electronics'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'مستهلكات صيانة'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 25, 0, 0, 5, 'رف المكونات الإلكترونية', 'A', '09', 'Consumables', 'RTWMS-IPA-70', 'none'),
  ('RT-CMP-RTV-SILICONE', 'سيليكون RTV حراري', 'مادة تثبيت وعزل حراري للتجميع.', 'Electronics', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Electronics'), 'components', (SELECT `id` FROM `componentTypes` WHERE `name` = 'مستهلكات صيانة'), (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), NULL, 18, 0, 0, 4, 'رف المكونات الإلكترونية', 'A', '09', 'Consumables', 'RTWMS-RTV-SIL', 'none'),
  ('RT-PRD-PHOTO-CONTROL', 'لوحة تحكم فوتوثيرابي', 'منتج تحت التشغيل: لوحة التحكم الأساسية لأجهزة الفوتوثيرابي.', 'Boards', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Boards'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), 'work_in_progress', 8, 0, 0, 2, 'رف التجميع الطبي', 'B', '01', 'Boards', 'RTWMS-PHOTO-CONTROL', 'serial'),
  ('TGT-PHOTO-LITE-V1', 'جهاز فوتوثيرابي Target Lite V1', 'الإصدار الأول الاقتصادي لجهاز العلاج الضوئي من Target.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'TARGET'), 'final_operational', 3, 0, 0, 1, 'رف المنتجات النهائية', 'C', '01', 'Devices', 'RTWMS-TGT-PHOTO-LITE1', 'serial'),
  ('TGT-PHOTO-PLUS-V2', 'جهاز فوتوثيرابي Target Plus V2', 'الإصدار الثاني بقدرة أعلى وتبريد إضافي.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'TARGET'), 'final_operational', 2, 0, 0, 1, 'رف المنتجات النهائية', 'C', '01', 'Devices', 'RTWMS-TGT-PHOTO-PLUS2', 'serial'),
  ('TGT-PHOTO-PRO-V3', 'جهاز فوتوثيرابي Target Pro V3', 'الإصدار الثالث الاحترافي متعدد مصادر الضوء.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'TARGET'), 'final_operational', 1, 0, 0, 1, 'رف المنتجات النهائية', 'C', '01', 'Devices', 'RTWMS-TGT-PHOTO-PRO3', 'serial'),
  ('RT-PRD-VITAL-MONITOR', 'وحدة مراقبة حيوية تجريبية', 'منتج افتراضي لجهاز مراقبة حيوية للتخطيط والاختبار.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), 'under_review', 2, 0, 0, 1, 'رف التجميع الطبي', 'B', '02', 'Devices', 'RTWMS-VITAL-MON', 'serial'),
  ('RT-PRD-NEBULIZER-CTRL', 'وحدة تحكم نيبولايزر', 'منتج افتراضي لوحدة تحكم جهاز استنشاق.', 'Medical', (SELECT `id` FROM `inventoryCategories` WHERE `name` = 'Medical'), 'products', NULL, (SELECT `id` FROM `companies` WHERE `code` = 'RT-CORE'), 'finished', 3, 0, 0, 1, 'رف التجميع الطبي', 'B', '02', 'Devices', 'RTWMS-NEB-CTRL', 'serial')
ON DUPLICATE KEY UPDATE `partNumber` = `partNumber`;

INSERT IGNORE INTO `serialAssets` (`serialNumber`, `partId`, `status`, `locationId`, `assetCondition`, `manufacturerSerial`, `notes`)
SELECT serials.`serialNumber`, product.`id`, 'in_stock', location.`id`, 'جديد', serials.`manufacturerSerial`, 'وحدة افتراضية لعرض التتبع التسلسلي في المخزن.'
FROM (
  SELECT 'TGT-LITE-DEMO-001' AS `serialNumber`, 'TGT-PHOTO-LITE-V1' AS `partNumber`, 'LITE-V1-001' AS `manufacturerSerial` UNION ALL
  SELECT 'TGT-LITE-DEMO-002', 'TGT-PHOTO-LITE-V1', 'LITE-V1-002' UNION ALL
  SELECT 'TGT-LITE-DEMO-003', 'TGT-PHOTO-LITE-V1', 'LITE-V1-003' UNION ALL
  SELECT 'TGT-PLUS-DEMO-001', 'TGT-PHOTO-PLUS-V2', 'PLUS-V2-001' UNION ALL
  SELECT 'TGT-PLUS-DEMO-002', 'TGT-PHOTO-PLUS-V2', 'PLUS-V2-002' UNION ALL
  SELECT 'TGT-PRO-DEMO-001', 'TGT-PHOTO-PRO-V3', 'PRO-V3-001'
) AS serials
INNER JOIN `parts` AS product ON product.`partNumber` = serials.`partNumber`
INNER JOIN `storageLocations` AS location ON location.`code` = 'RT-PROD-C01';

INSERT INTO `productComponents` (`productId`, `componentId`, `quantityRequired`, `notes`)
SELECT product.`id`, component.`id`, bom.`quantityRequired`, bom.`notes`
FROM (
  SELECT 'RT-PRD-PHOTO-CONTROL' AS `productNumber`, 'RT-CMP-LED-455' AS `componentNumber`, 16 AS `quantityRequired`, 'مصفوفة ضوء علاجية' AS `notes` UNION ALL
  SELECT 'RT-PRD-PHOTO-CONTROL', 'RT-CMP-MCU-STM32F103', 1, 'وحدة التحكم' UNION ALL
  SELECT 'RT-PRD-PHOTO-CONTROL', 'RT-CMP-PCB-PHOTO-CTRL', 1, 'لوحة خامة' UNION ALL
  SELECT 'RT-PRD-PHOTO-CONTROL', 'RT-CMP-OLED-12864', 1, 'واجهة العرض' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-PRD-PHOTO-CONTROL', 1, 'لوحة التحكم' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-PSU-24V-5A', 1, 'تغذية الجهاز' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-FAN-12V-80', 1, 'تبريد' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-ENCLOSURE-PHOTO', 1, 'هيكل الجهاز' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-CABLE-MED-2M', 1, 'كابل طبي' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-FOOTSWITCH', 1, 'تحكم بالقدم' UNION ALL
  SELECT 'TGT-PHOTO-LITE-V1', 'RT-CMP-SCREW-M3', 12, 'تثبيت' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-PRD-PHOTO-CONTROL', 1, 'لوحة التحكم' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-PSU-24V-5A', 1, 'تغذية الجهاز' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-FAN-12V-80', 2, 'تبريد إضافي' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-ENCLOSURE-PHOTO', 1, 'هيكل الجهاز' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-CABLE-MED-2M', 1, 'كابل طبي' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-FOOTSWITCH', 1, 'تحكم بالقدم' UNION ALL
  SELECT 'TGT-PHOTO-PLUS-V2', 'RT-CMP-SCREW-M3', 16, 'تثبيت' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-PRD-PHOTO-CONTROL', 2, 'لوحتا تحكم' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-PSU-24V-5A', 2, 'تغذية مزدوجة' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-FAN-12V-80', 2, 'تبريد احترافي' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-ENCLOSURE-PHOTO', 1, 'هيكل الجهاز' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-CABLE-MED-2M', 1, 'كابل طبي' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-FOOTSWITCH', 1, 'تحكم بالقدم' UNION ALL
  SELECT 'TGT-PHOTO-PRO-V3', 'RT-CMP-SCREW-M3', 24, 'تثبيت احترافي' UNION ALL
  SELECT 'RT-PRD-VITAL-MONITOR', 'RT-CMP-MCU-STM32F103', 1, 'وحدة تحكم' UNION ALL
  SELECT 'RT-PRD-VITAL-MONITOR', 'RT-CMP-OLED-12864', 1, 'واجهة عرض' UNION ALL
  SELECT 'RT-PRD-VITAL-MONITOR', 'RT-CMP-PCB-PHOTO-CTRL', 1, 'لوحة اختبارية' UNION ALL
  SELECT 'RT-PRD-NEBULIZER-CTRL', 'RT-CMP-MCU-STM32F103', 1, 'وحدة تحكم' UNION ALL
  SELECT 'RT-PRD-NEBULIZER-CTRL', 'RT-CMP-PCB-PHOTO-CTRL', 1, 'لوحة اختبارية'
) AS bom
INNER JOIN `parts` AS product ON product.`partNumber` = bom.`productNumber`
INNER JOIN `parts` AS component ON component.`partNumber` = bom.`componentNumber`
ON DUPLICATE KEY UPDATE `productId` = `productId`;
