import mysql from "mysql2/promise";

const DEMO_MARKER = "[بيانات تجريبية]";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the warehouse demo data.");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const asMysqlDate = hoursAgo => {
  const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace("T", " ");
};

const one = async (sql, values = []) => {
  const [rows] = await connection.execute(sql, values);
  return rows[0] ?? null;
};

const insertOnce = async ({ table, whereSql, whereValues, columns, values }) => {
  const existing = await one(`SELECT id FROM \`${table}\` WHERE ${whereSql} LIMIT 1`, whereValues);
  if (existing) return Number(existing.id);
  const placeholders = columns.map(() => "?").join(", ");
  const [result] = await connection.execute(
    `INSERT INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
    values,
  );
  return Number(result.insertId);
};

const requireAccount = async role => {
  const account = await one("SELECT id, name FROM users WHERE role = ? ORDER BY id ASC LIMIT 1", [role]);
  if (!account) throw new Error(`A ${role} account is required before running the demo seed.`);
  return { id: Number(account.id), name: account.name || (role === "admin" ? "مسؤول المخزن" : "مهندس التشغيل") };
};

try {
  await connection.beginTransaction();

  const admin = await requireAccount("admin");
  const engineer = await requireAccount("user");

  const departmentRows = [
    ["معمل النماذج الطبية", "DEMO-MED", "تجهيز واختبار النماذج الطبية ضمن بيئة العرض.", 1],
    ["مختبر الأنظمة المضمنة", "DEMO-EMB", "تطوير النظم المضمنة والبرمجيات الثابتة ضمن بيئة العرض.", 1],
    ["وحدة تصنيع اللوحات", "DEMO-PCB", "إنتاج وتجميع اللوحات الإلكترونية ضمن بيئة العرض.", 1],
    ["تشغيل المخزن", "DEMO-WH", "تنظيم الاستلام والصرف والتسليم داخل بيئة العرض.", 1],
  ];
  const departments = {};
  for (const [name, code, description, isActive] of departmentRows) {
    departments[code] = await insertOnce({
      table: "departments",
      whereSql: "code = ?",
      whereValues: [code],
      columns: ["name", "code", "description", "isActive"],
      values: [name, code, description, isActive],
    });
  }

  const employees = [
    ["مدير المخزن التجريبي", "demo.warehouse@reverse.local", "DEMO-WH-001", "مسؤول تشغيل المخزن", departments["DEMO-WH"], "admin"],
    ["مهندسة النظم المضمنة التجريبية", "demo.embedded@reverse.local", "DEMO-EMB-001", "مهندسة نظم مضمنة", departments["DEMO-EMB"], "engineer"],
    ["فني تصنيع اللوحات التجريبي", "demo.pcb@reverse.local", "DEMO-PCB-001", "فني لوحات إلكترونية", departments["DEMO-PCB"], "engineer"],
    ["مهندسة المعمل الطبي التجريبية", "demo.medical@reverse.local", "DEMO-MED-001", "مهندسة أجهزة طبية", departments["DEMO-MED"], "engineer"],
  ];
  for (const [fullName, email, employeeCode, jobTitle, departmentId, warehouseRole] of employees) {
    await insertOnce({
      table: "employeeProfiles",
      whereSql: "employeeCode = ?",
      whereValues: [employeeCode],
      columns: ["fullName", "email", "employeeCode", "jobTitle", "departmentId", "warehouseRole", "isActive"],
      values: [fullName, email, employeeCode, jobTitle, departmentId, warehouseRole, 1],
    });
  }

  const categoryRows = [
    ["طبي", "blue"],
    ["إمبيديد", "purple"],
    ["إلكترونيات", "orange"],
    ["لوحات", "green"],
    ["معمل الطباعة ثلاثية الأبعاد", "pink"],
    ["تشغيل وصيانة", "slate"],
  ];
  const categories = {};
  for (const [name, colorKey] of categoryRows) {
    categories[name] = await insertOnce({
      table: "inventoryCategories",
      whereSql: "name = ?",
      whereValues: [name],
      columns: ["name", "description", "colorKey", "isActive", "createdById"],
      values: [name, `${DEMO_MARKER} تصنيف عرض قابل للتعديل من الأدمن.`, colorKey, 1, admin.id],
    });
  }

  const typeRows = [
    ["مقاومات ومكثفات SMD", "مكونات إلكترونية دقيقة للاستخدام في النماذج واللوحات."],
    ["موصلات صناعية", "موصلات وأسلاك وأطراف للاستخدام التشغيلي."],
    ["مستلزمات معمل", "مواد استهلاكية وأدوات تنظيم ومعايرة."],
    ["أدوات معايرة واختبار", "أدوات قياس واختبار للأجهزة واللوحات."],
  ];
  const componentTypes = {};
  for (const [name, description] of typeRows) {
    componentTypes[name] = await insertOnce({
      table: "componentTypes",
      whereSql: "name = ?",
      whereValues: [name],
      columns: ["name", "description", "isActive", "createdById"],
      values: [name, `${DEMO_MARKER} ${description}`, 1, admin.id],
    });
  }

  const companyRows = [
    ["شركة ميدتك فيجن", "DEMO-MEDTECH", "مسؤول حلول الأجهزة", "+20 100 000 0101", "medtech.demo@reverse.local", "شركة عرض لأجهزة ومشروعات طبية."],
    ["شركة كونترول لاب", "DEMO-CONTROL", "فريق اللوحات والتحكم", "+20 100 000 0102", "control.demo@reverse.local", "شركة عرض لمنتجات التحكم واللوحات."],
  ];
  const companies = {};
  for (const [name, code, contactName, contactPhone, contactEmail, notes] of companyRows) {
    companies[code] = await insertOnce({
      table: "companies",
      whereSql: "code = ?",
      whereValues: [code],
      columns: ["name", "code", "contactName", "contactPhone", "contactEmail", "notes", "isActive", "createdById"],
      values: [name, code, contactName, contactPhone, contactEmail, `${DEMO_MARKER} ${notes}`, 1, admin.id],
    });
  }

  const partRows = [
    ["DEMO-MED-001", "لوحة واجهة حساس طبي", "طبي", "components", "أدوات معايرة واختبار", 14, 0, 8, "المخزن الرئيسي", "A-02", "03", "MED-01", "لوحة اختبار حساسات طبية للاستخدام التجريبي في العرض.", null, null],
    ["DEMO-EMB-001", "وحدة تطوير ESP32", "إمبيديد", "components", "موصلات صناعية", 42, 5, 12, "رف الأنظمة المضمنة", "B-01", "04", "EMB-02", "وحدة تحكم لاسلكية لتجربة الطلب والاعتماد والحجز.", null, null],
    ["DEMO-PCB-001", "لوحة تحكم طبية تحت التشغيل", "لوحات", "products", "مستلزمات معمل", 6, 0, 5, "رف تصنيع اللوحات", "C-03", "02", "PCB-03", "لوحة تحت التشغيل توضح ربط المنتج بمكوناته.", "DEMO-MEDTECH", "work_in_progress"],
    ["DEMO-PROD-001", "وحدة مراقبة حيوية تامة", "طبي", "products", "مستلزمات معمل", 3, 0, 1, "منطقة المنتجات الطبية", "C-01", "01", "MED-PROD-01", "منتج تام تابع لشركة طبية ويحتوي قائمة مكونات موثقة.", "DEMO-MEDTECH", "finished"],
    ["DEMO-3DP-001", "بكرة PLA أسود للطباعة ثلاثية الأبعاد", "معمل الطباعة ثلاثية الأبعاد", "components", "مستلزمات معمل", 2, 0, 4, "معمل الطباعة", "D-01", "01", "3DP-01", "رصيد منخفض مقصود لإظهار تنبيه إعادة التوريد.", null, null],
    ["DEMO-MNT-001", "عبوة أكياس ESD", "تشغيل وصيانة", "products", "مستلزمات معمل", 120, 0, 30, "منطقة التشغيل", "E-01", "05", "MNT-01", "مواد حماية وتجهيز للقطع الإلكترونية.", "DEMO-CONTROL", "finished"],
  ];
  const parts = {};
  for (const [partNumber, name, category, warehouseSection, typeName, quantity, reservedQuantity, minimumStock, location, storageShelf, storageDrawer, storageBox, description, companyCode, productStage] of partRows) {
    parts[partNumber] = await insertOnce({
      table: "parts",
      whereSql: "partNumber = ?",
      whereValues: [partNumber],
      columns: ["partNumber", "name", "description", "category", "categoryId", "warehouseSection", "componentTypeId", "companyId", "productStage", "quantity", "reservedQuantity", "minimumStock", "location", "storageShelf", "storageDrawer", "storageBox", "specifications", "createdById"],
      values: [partNumber, name, `${DEMO_MARKER} ${description}`, category, categories[category], warehouseSection, componentTypes[typeName], companyCode ? companies[companyCode] : null, productStage, quantity, reservedQuantity, minimumStock, location, storageShelf, storageDrawer, storageBox, "حالة: بيانات عرض. لا تستخدم كمواصفة إنتاجية.", admin.id],
    });
    await connection.execute("UPDATE parts SET name = ?, companyId = ?, productStage = ? WHERE id = ?", [name, companyCode ? companies[companyCode] : null, productStage, parts[partNumber]]);
  }

  const productBomRows = [["DEMO-PCB-001", "DEMO-EMB-001", 1, "وحدة التحكم الأساسية للوحة تحت التشغيل."], ["DEMO-PCB-001", "DEMO-MED-001", 1, "واجهة الحساس ضمن اللوحة."], ["DEMO-PROD-001", "DEMO-EMB-001", 1, "وحدة التحكم داخل المنتج التام."], ["DEMO-PROD-001", "DEMO-MED-001", 1, "واجهة الحساس داخل المنتج التام."]];
  for (const [productNumber, componentNumber, quantityRequired, notes] of productBomRows) {
    await insertOnce({ table: "productComponents", whereSql: "productId = ? AND componentId = ?", whereValues: [parts[productNumber], parts[componentNumber]], columns: ["productId", "componentId", "quantityRequired", "notes"], values: [parts[productNumber], parts[componentNumber], quantityRequired, `${DEMO_MARKER} ${notes}`] });
  }

  const requestRows = [
    ["DEMO-REQ-PENDING", "DEMO-MNT-001", 10, "طلب تجهيز محطة اختبار جديدة", "pending", null, null, null, null],
    ["DEMO-REQ-APPROVED", "DEMO-EMB-001", 5, "تطوير نموذج مراقبة لاسلكي", "approved", "تم الحجز للتجهيز والتسليم اليدوي.", admin.id, asMysqlDate(18), null],
    ["DEMO-REQ-DELIVERED", "DEMO-MED-001", 4, "اختبار واجهة حساس في نموذج طبي", "delivered", "تم التسليم اليدوي وتوثيق الاستلام.", admin.id, asMysqlDate(72), asMysqlDate(48)],
    ["DEMO-REQ-REJECTED", "DEMO-PCB-001", 12, "تجهيز دفعة إنتاج خارج خطة العمل", "rejected", "الرصيد المتاح لا يغطي الكمية المطلوبة حاليًا.", admin.id, asMysqlDate(30), null],
  ];
  const requests = {};
  for (const [key, partNumber, requestedQuantity, purpose, status, decisionNote, reviewerId, reviewedAt, deliveredAt] of requestRows) {
    const partId = parts[partNumber];
    const existing = await one("SELECT id FROM dispensingRequests WHERE purpose = ? LIMIT 1", [`${DEMO_MARKER} ${purpose}`]);
    if (existing) {
      requests[key] = Number(existing.id);
      continue;
    }
    const [result] = await connection.execute(
      "INSERT INTO dispensingRequests (partId, requestedById, requestedQuantity, purpose, recipientName, recipientDepartment, projectReference, requestNote, status, decisionNote, reviewedById, reviewedAt, deliveredById, deliveredAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [partId, engineer.id, requestedQuantity, `${DEMO_MARKER} ${purpose}`, "المستلم التجريبي", "مختبر الأنظمة المضمنة", "DEMO-DEVICE-01", `${DEMO_MARKER} بيانات طلب تظهر تلقائيًا في الفاتورة.`, status, decisionNote ? `${DEMO_MARKER} ${decisionNote}` : null, reviewerId, reviewedAt, status === "delivered" ? admin.id : null, deliveredAt, asMysqlDate(status === "delivered" ? 96 : 24)],
    );
    requests[key] = Number(result.insertId);
  }
  await connection.execute("UPDATE dispensingRequests SET recipientName = ?, recipientDepartment = ?, projectReference = ?, requestNote = ? WHERE id IN (?, ?, ?, ?)", ["المستلم التجريبي", "مختبر الأنظمة المضمنة", "DEMO-DEVICE-01", `${DEMO_MARKER} بيانات طلب تظهر تلقائيًا في الفاتورة.`, requests["DEMO-REQ-PENDING"], requests["DEMO-REQ-APPROVED"], requests["DEMO-REQ-DELIVERED"], requests["DEMO-REQ-REJECTED"]]);

  const deliveredInvoiceId = await insertOnce({
    table: "handoverInvoices",
    whereSql: "invoiceNumber = ?",
    whereValues: ["DEMO-INV-0001"],
    columns: ["invoiceNumber", "requestId", "partId", "issuedById", "receivedById", "partNumberSnapshot", "partNameSnapshot", "warehouseSectionSnapshot", "quantity", "purposeSnapshot", "requesterNameSnapshot", "recipientNameSnapshot", "recipientDepartmentSnapshot", "projectReferenceSnapshot", "requestNoteSnapshot", "deliveryNote", "issuedAt", "receiptConfirmedAt", "receiptConfirmationName", "receiptNote"],
    values: ["DEMO-INV-0001", requests["DEMO-REQ-DELIVERED"], parts["DEMO-MED-001"], admin.id, engineer.id, "DEMO-MED-001", "لوحة واجهة حساس طبي", "components", 4, `${DEMO_MARKER} اختبار واجهة حساس في نموذج طبي`, engineer.name, "المستلم التجريبي", "مختبر الأنظمة المضمنة", "DEMO-DEVICE-01", `${DEMO_MARKER} بيانات طلب تظهر تلقائيًا في الفاتورة.`, `${DEMO_MARKER} تم التسليم من رف A-02 بحالة سليمة.`, asMysqlDate(48), asMysqlDate(44), engineer.name, `${DEMO_MARKER} تم تأكيد الاستلام في بيئة العرض.`],
  });
  await connection.execute("UPDATE handoverInvoices SET requesterNameSnapshot = ?, recipientNameSnapshot = ?, recipientDepartmentSnapshot = ?, projectReferenceSnapshot = ?, requestNoteSnapshot = ?, deliveryNote = ? WHERE id = ?", [engineer.name, "المستلم التجريبي", "مختبر الأنظمة المضمنة", "DEMO-DEVICE-01", `${DEMO_MARKER} بيانات طلب تظهر تلقائيًا في الفاتورة.`, `${DEMO_MARKER} تم التسليم من رف A-02 بحالة سليمة.`, deliveredInvoiceId]);

  const transactionRows = [
    ["DEMO-MED-001", requests["DEMO-REQ-DELIVERED"], "delivery_confirmed", -4, 18, 14, admin.id, engineer.id, "تم تسليم لوحة واجهة الحساس وإصدار فاتورة العرض."],
    ["DEMO-EMB-001", requests["DEMO-REQ-APPROVED"], "request_approved", 0, 42, 42, admin.id, engineer.id, "تم اعتماد الطلب وحجز 5 وحدات للتجهيز."],
    ["DEMO-MNT-001", requests["DEMO-REQ-PENDING"], "request_submitted", 0, 120, 120, engineer.id, engineer.id, "تم تسجيل طلب تجهيز محطة اختبار."],
  ];
  for (const [partNumber, requestId, type, quantityDelta, quantityBefore, quantityAfter, actorId, engineerId, details] of transactionRows) {
    const key = `${DEMO_MARKER} ${details}`;
    const exists = await one("SELECT id FROM inventoryTransactions WHERE details = ? LIMIT 1", [key]);
    if (exists) continue;
    const part = partRows.find(row => row[0] === partNumber);
    await connection.execute(
      "INSERT INTO inventoryTransactions (partId, requestId, type, quantityDelta, quantityBefore, quantityAfter, actorId, engineerId, partNumberSnapshot, partNameSnapshot, warehouseSectionSnapshot, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [parts[partNumber], requestId, type, quantityDelta, quantityBefore, quantityAfter, actorId, engineerId, partNumber, part[1], part[3], key, asMysqlDate(type === "delivery_confirmed" ? 48 : 18)],
    );
  }

  const alertRows = [
    ["new_request", "طلب صرف جديد للمتابعة", "يوجد طلب تجريبي قيد المراجعة لتجهيز محطة اختبار.", parts["DEMO-MNT-001"], requests["DEMO-REQ-PENDING"], null, 0],
    ["low_stock", "رصيد منخفض يحتاج قرار شراء", "رصيد بكرة PLA السوداء أقل من الحد الأدنى المحدد.", parts["DEMO-3DP-001"], null, null, 0],
    ["request_approved", "تم اعتماد طلبك التجريبي", "تم حجز 5 وحدات تطوير ESP32 للتجهيز.", parts["DEMO-EMB-001"], requests["DEMO-REQ-APPROVED"], engineer.id, 0],
    ["handover_completed", "تم تسليم طلبك التجريبي", "تتوفر فاتورة التسليم وتأكيد الاستلام داخل طلباتك.", parts["DEMO-MED-001"], requests["DEMO-REQ-DELIVERED"], engineer.id, 1],
  ];
  for (const [type, title, body, partId, requestId, recipientUserId, isRead] of alertRows) {
    await insertOnce({
      table: "warehouseAlerts",
      whereSql: "title = ?",
      whereValues: [`${DEMO_MARKER} ${title}`],
      columns: ["type", "title", "body", "partId", "requestId", "recipientUserId", "isRead", "createdAt"],
      values: [type, `${DEMO_MARKER} ${title}`, `${DEMO_MARKER} ${body}`, partId, requestId, recipientUserId, isRead, asMysqlDate(12)],
    });
  }

  const activityRows = [
    ["request_submitted", engineer.id, "تم إنشاء طلب صرف تجريبي", "طلب تجهيز محطة اختبار بانتظار متابعة مسؤول المخزن.", requests["DEMO-REQ-PENDING"], parts["DEMO-MNT-001"], 12],
    ["request_approved", admin.id, "تم اعتماد وحجز كمية تجريبية", "حُجزت 5 وحدات ESP32 لتجهيزها قبل التسليم.", requests["DEMO-REQ-APPROVED"], parts["DEMO-EMB-001"], 18],
    ["handover_completed", admin.id, "تم تسليم طلب تجريبي", "أُصدرت الفاتورة DEMO-INV-0001 بانتظار أو مع تأكيد الاستلام.", requests["DEMO-REQ-DELIVERED"], parts["DEMO-MED-001"], 48],
    ["handover_receipt_confirmed", engineer.id, "تم تأكيد استلام الفاتورة", `تم تأكيد استلام فاتورة العرض رقم ${deliveredInvoiceId}.`, requests["DEMO-REQ-DELIVERED"], parts["DEMO-MED-001"], 44],
  ];
  for (const [type, actorId, title, detail, requestId, partId, hoursAgo] of activityRows) {
    await insertOnce({
      table: "warehouseActivities",
      whereSql: "title = ? AND detail = ?",
      whereValues: [`${DEMO_MARKER} ${title}`, `${DEMO_MARKER} ${detail}`],
      columns: ["type", "actorId", "title", "detail", "requestId", "partId", "createdAt"],
      values: [type, actorId, `${DEMO_MARKER} ${title}`, `${DEMO_MARKER} ${detail}`, requestId, partId, asMysqlDate(hoursAgo)],
    });
  }

  await connection.commit();
  console.log("Demo warehouse data is ready. Re-running this command is safe and will not duplicate records.");
} catch (error) {
  await connection.rollback();
  console.error("Demo seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  connection.destroy();
}
