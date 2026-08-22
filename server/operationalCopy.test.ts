import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(resolve(project, file), "utf8");

describe("operational product copy", () => {
  it("keeps authentication and shell copy factual rather than promotional", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("منصة REVERSE TECH الداخلية لإدارة المخزون والطلبات.");
    expect(layout).toContain("جلسة العمل نشطة");
    expect(layout).not.toContain("دخول آمن لعمليات مخزن");
    expect(layout).not.toContain("النظام يعمل");
  });

  it("uses specific operational language for the dashboard and dispensing action", () => {
    const home = source("client/src/pages/Home.tsx");
    const dialog = source("client/src/components/DispensingRequestDialog.tsx");
    expect(home).toContain("تابع الرصيد الفعلي والمحجوز والمتاح");
    expect(dialog).toContain("تم تسجيل الطلب وإشعار مسؤول المخزن.");
    expect(dialog).not.toContain("تم إرسال طلب الصرف بنجاح.");
  });

  it("keeps request, invoice, and receipt messages tied to actual operational states", () => {
    const requests = source("client/src/pages/Requests.tsx");
    const invoices = source("client/src/pages/Invoices.tsx");
    const myRequests = source("client/src/pages/MyRequests.tsx");
    expect(requests).toContain("سجّل ملاحظة التسليم عند تسليم القطعة فعليًا لإنشاء فاتورة مستقلة.");
    expect(invoices).toContain("كل فاتورة تفتح في صفحة مستقلة تضم بيانات الطلب والاستلام والصنف والتأكيد الرقمي");
    expect(myRequests).toContain("ولا تتوفر بيانات فاتورة مرتبطة بهذا الطلب بعد");
    expect(myRequests).not.toContain("وستظهر فاتورتك هنا قريبًا");
  });

  it("uses role-specific notification wording and factual empty states", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("طلبات صرف جديدة وتنبيهات رصيد تحتاج متابعة");
    expect(layout).toContain("لا توجد إشعارات غير مقروءة");
    expect(layout).toContain("لا توجد إشعارات مسجلة في هذه الجلسة.");
    expect(layout).not.toContain("لا توجد تنبيهات حتى الآن.");
  });

  it("keeps empty and error states actionable across the core warehouse screens", () => {
    const inventory = source("client/src/pages/Inventory.tsx");
    const requests = source("client/src/pages/Requests.tsx");
    const invoices = source("client/src/pages/Invoices.tsx");
    const partForm = source("client/src/components/PartFormDialog.tsx");
    expect(inventory).toContain("لا توجد {label} مطابقة");
    expect(requests).toContain("ستظهر طلبات المهندسين الواردة هنا.");
    expect(invoices).toContain("لا توجد فواتير مطابقة للبحث.");
    expect(partForm).toContain("أدخل البيانات الأساسية واختر تصنيف المخزون.");
    expect(partForm).toContain("الصورة يجب أن تكون JPG أو PNG أو WEBP وبحد أقصى 5MB.");
  });
});
