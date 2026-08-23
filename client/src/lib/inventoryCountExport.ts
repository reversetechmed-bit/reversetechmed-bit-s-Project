import { exportReportExcel, exportReportPdf, type ReportColumn } from "./reportExport";

export type InventoryCountExportPeriod = "daily" | "weekly";
export type InventoryCountSummary = {
  session: { countNumber: string; warehouseSection: "components" | "products" | "all" | null; status: string; createdAt: Date | string; submittedAt?: Date | string | null; approvedAt?: Date | string | null };
  totalLines: number;
  countedLines: number;
  varianceLines: number;
};
type ExportRow = { countNumber: string; scope: string; status: string; openedAt: string; submittedAt: string; approvedAt: string; totalLines: number; countedLines: number; varianceLines: number };

const scopeLabel = (value: InventoryCountSummary["session"]["warehouseSection"]) => value === "components" ? "المكونات" : value === "products" ? "المنتجات" : "كل المخزون";
const statusLabel: Record<string, string> = { draft: "مسودة", open: "مفتوح للعد", submitted: "بانتظار الاعتماد", approved: "معتمد", cancelled: "ملغى" };
const format = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) : "—";

export function filterInventoryCountReportRows(sessions: InventoryCountSummary[], period: InventoryCountExportPeriod, now = new Date()) {
  const threshold = new Date(now);
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (period === "daily" ? 1 : 6));
  return sessions.filter(item => new Date(item.session.createdAt) >= threshold).map(item => ({
    countNumber: item.session.countNumber,
    scope: scopeLabel(item.session.warehouseSection),
    status: statusLabel[item.session.status] ?? item.session.status,
    openedAt: format(item.session.createdAt),
    submittedAt: format(item.session.submittedAt),
    approvedAt: format(item.session.approvedAt),
    totalLines: item.totalLines,
    countedLines: item.countedLines,
    varianceLines: item.varianceLines,
  }));
}

export const inventoryCountReportColumns: ReportColumn<ExportRow>[] = [
  { label: "رقم جلسة الجرد", value: row => row.countNumber },
  { label: "نطاق الجرد", value: row => row.scope },
  { label: "الحالة", value: row => row.status },
  { label: "تاريخ الفتح", value: row => row.openedAt },
  { label: "تاريخ الإرسال", value: row => row.submittedAt },
  { label: "تاريخ الاعتماد", value: row => row.approvedAt },
  { label: "إجمالي البنود", value: row => row.totalLines },
  { label: "البنود المعدودة", value: row => row.countedLines },
  { label: "بنود بها فرق", value: row => row.varianceLines },
];

function reportMeta(period: InventoryCountExportPeriod) {
  const periodLabel = period === "daily" ? "اليومي" : "الأسبوعي";
  return { title: `تقرير الجرد ${periodLabel}`, filePrefix: `reverse-tech-inventory-count-${period}` };
}

export async function exportInventoryCountReport(formatType: "excel" | "pdf", period: InventoryCountExportPeriod, sessions: InventoryCountSummary[]) {
  const rows = filterInventoryCountReportRows(sessions, period);
  const { title, filePrefix } = reportMeta(period);
  if (formatType === "excel") return exportReportExcel(title, filePrefix, inventoryCountReportColumns, rows);
  return exportReportPdf(title, filePrefix, inventoryCountReportColumns, rows);
}
