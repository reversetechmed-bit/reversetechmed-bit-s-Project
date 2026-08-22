import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { exportHandoverInvoiceExcel, exportHandoverInvoicePdf } from "@/lib/handoverInvoiceExport";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useLocation, useRoute } from "wouter";

const logo = "/manus-storage/reverse-tech-invoice-logo_c78e2e38.webp";
const text = (value: string | null | undefined) => value?.trim() || "—";
const formatDate = (value: Date | string) => new Date(value).toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" });
const formatTime = (value: Date | string) => new Date(value).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
const section = (value: "components" | "products") => value === "products" ? "المنتجات" : "المكونات";

export default function InvoiceDocument() {
  const { user } = useAuth(); const [, params] = useRoute("/invoice/:id"); const [, setLocation] = useLocation(); const invoiceId = Number(params?.id);
  const { data, isLoading, error } = trpc.warehouse.invoices.get.useQuery({ invoiceId }, { enabled: Number.isInteger(invoiceId) && invoiceId > 0 });
  if (isLoading) return <div className="panel mx-auto max-w-3xl p-10 text-center text-sm text-slate-500">يجري تحميل مستند الفاتورة…</div>;
  if (!data || error) return <div className="panel mx-auto max-w-3xl p-10 text-center"><FileText className="mx-auto h-7 w-7 text-[#a97937]" /><h1 className="mt-4 text-xl font-bold text-[#18354a]">تعذر فتح الفاتورة</h1><p className="mt-2 text-sm text-slate-500">قد لا تكون الفاتورة موجودة أو لا تملك صلاحية الاطلاع عليها.</p><Button className="mt-5" variant="outline" onClick={() => setLocation(user?.role === "admin" ? "/invoices" : "/my-requests")}>العودة</Button></div>;
  const { invoice, receiver } = data;
  const exportPdf = () => exportHandoverInvoicePdf(data).catch(() => undefined);
  const exportExcel = () => exportHandoverInvoiceExcel(data).catch(() => undefined);
  return <div className="space-y-5 print:bg-white">
    <div className="mx-auto flex max-w-[794px] flex-wrap items-center justify-between gap-3 print:hidden"><Button variant="outline" onClick={() => setLocation(user?.role === "admin" ? "/invoices" : "/my-requests")} className="gap-2"><ArrowRight className="h-4 w-4" />العودة إلى السجل</Button><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4 text-[#a97937]" />Excel</Button><Button variant="outline" onClick={exportPdf} className="gap-2"><Download className="h-4 w-4 text-[#a97937]" />PDF</Button><Button onClick={() => window.print()} className="gap-2 bg-[#17374c] text-white hover:bg-[#102938]"><Printer className="h-4 w-4" />طباعة</Button></div></div>
    <article className="invoice-document mx-auto min-h-[1123px] max-w-[794px] bg-white p-7 text-right shadow-xl shadow-[#17374c]/10 sm:p-10 print:min-h-0 print:w-full print:max-w-none print:p-0 print:shadow-none" dir="rtl">
      <header className="border-b-2 border-[#b58a4a] pb-5 text-center"><img src={logo} alt="REVERSE TECH" className="mx-auto h-auto w-56 max-w-full object-contain" /><p className="mt-4 text-[11px] font-bold tracking-[.16em] text-[#a97937]">REVERSE TECH · WAREHOUSE MANAGEMENT</p><h1 className="mt-2 font-heading text-2xl font-extrabold text-[#17374c]">فاتورة تسليم من المخزن</h1><p className="mt-1 text-sm text-slate-500">مستند تسليم تشغيلي مستقل</p></header>
      <section className="mt-5 grid gap-3 sm:grid-cols-3"><Info label="رقم الفاتورة" value={invoice.invoiceNumber} mono /><Info label="تاريخ التسليم" value={formatDate(invoice.issuedAt)} /><Info label="وقت التسليم" value={formatTime(invoice.issuedAt)} /></section>
      <Section title="بيانات الطلب والاستلام"><div className="grid gap-3 sm:grid-cols-2"><Info label="اسم اليوزر مقدم الطلب" value={text(invoice.requesterNameSnapshot)} /><Info label="الشخص المستلم" value={text(invoice.recipientNameSnapshot || receiver.name || receiver.email)} /><Info label="القسم أو الجهة" value={text(invoice.recipientDepartmentSnapshot)} /><Info label="مرجع المشروع أو الجهاز" value={text(invoice.projectReferenceSnapshot)} /></div></Section>
      <Section title="بيانات الصنف"><div className="grid gap-3 sm:grid-cols-2"><Info label="اسم الصنف" value={invoice.partNameSnapshot} /><Info label="كود الصنف" value={invoice.partNumberSnapshot} mono /><Info label="قسم المخزن" value={section(invoice.warehouseSectionSnapshot)} /><Info label="الكمية المسلّمة" value={`${invoice.quantity} وحدة`} /></div><Detail label="غرض الطلب" value={invoice.purposeSnapshot} /><Detail label="ملاحظة مقدم الطلب" value={text(invoice.requestNoteSnapshot)} /><Detail label="ملاحظة التسليم" value={text(invoice.deliveryNote)} /></Section>
      <Section title="تأكيد الاستلام الرقمي"><div className={`rounded-xl border p-4 ${invoice.receiptConfirmedAt ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="font-bold">{invoice.receiptConfirmedAt ? "تم تأكيد الاستلام رقميًا" : "بانتظار تأكيد الاستلام الرقمي"}</p><p className="mt-1 text-sm leading-6">{invoice.receiptConfirmedAt ? `تم التأكيد باسم ${text(invoice.receiptConfirmationName)} في ${formatDate(invoice.receiptConfirmedAt)}، ${formatTime(invoice.receiptConfirmedAt)}.` : "يمكن للمستخدم تأكيد الاستلام من صفحة «طلباتي» بعد التسليم الفعلي."}</p>{invoice.receiptNote && <p className="mt-2 border-t border-current/15 pt-2 text-sm">ملاحظة المستلم: {invoice.receiptNote}</p>}</div></Section>
      <footer className="mt-12 grid grid-cols-2 gap-8 text-center text-sm text-[#6e6a60]"><div className="border-t border-[#b58a4a] pt-2">أصدرها أدمن المخزن</div><div className="border-t border-[#b58a4a] pt-2">استلمها {text(invoice.recipientNameSnapshot || receiver.name)}</div></footer>
    </article>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-5"><h2 className="border-r-4 border-[#b58a4a] pr-3 font-heading font-extrabold text-[#17374c]">{title}</h2><div className="mt-3 rounded-xl border border-[#d9d0bf] bg-[#fcf8ef] p-4">{children}</div></section>; }
function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="rounded-lg border border-[#e4dccb] bg-white p-3"><p className="text-[11px] font-semibold text-[#8a7a60]">{label}</p><p className={`mt-1 break-words text-sm font-bold text-[#17374c] ${mono ? "font-mono" : ""}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="mt-3 rounded-lg border border-[#e4dccb] bg-white p-3"><p className="text-[11px] font-semibold text-[#8a7a60]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#17374c]">{value}</p></div>; }
