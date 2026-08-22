import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, FileJson2, LockKeyhole, ShieldAlert, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function BackupRestore() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [fileName, setFileName] = useState("");
  const [backupPayload, setBackupPayload] = useState<unknown>(null);
  const [confirmation, setConfirmation] = useState("");
  const downloadQuery = trpc.organization.backup.exportJson.useQuery(undefined, { enabled: false });
  const previewImport = trpc.organization.backup.previewImport.useMutation({ onError: error => toast.error(error.message) });
  const importMaster = trpc.organization.backup.importMasterData.useMutation({
    onSuccess: async ({ imported, warnings }) => {
      toast.success(`تم دمج البيانات الأساسية: ${Object.values(imported).reduce((total, count) => total + Number(count), 0)} سجل.`);
      warnings.forEach(warning => toast.info(warning));
      setConfirmation(""); setBackupPayload(null); setFileName("");
      await Promise.all([utils.warehouse.inventory.list.invalidate(), utils.organization.departments.list.invalidate(), utils.organization.employees.list.invalidate(), utils.organization.companies.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return <div className="panel mx-auto max-w-2xl p-10 text-center"><LockKeyhole className="mx-auto h-6 w-6 text-[#0178D4]" /><h1 className="mt-4 text-xl font-bold text-[#0B2E4E]">صلاحية أدمن مطلوبة</h1><p className="mt-2 text-sm text-slate-500">النسخ والاستعادة متاحان لمسؤولي المخزن فقط.</p></div>;

  const downloadBackup = async () => {
    const result = await downloadQuery.refetch();
    if (!result.data) return toast.error("تعذر إنشاء ملف النسخة الاحتياطية الآن.");
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `reverse-tech-warehouse-backup-${result.data.generatedAt.slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    toast.success(`تم تنزيل نسخة تضم ${Object.values(result.data.recordCounts).reduce((total, count) => total + Number(count), 0)} سجلًا.`);
  };

  const selectBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("حجم ملف النسخة يجب ألا يتجاوز 10 ميغابايت."); return; }
    try {
      const payload = JSON.parse(await file.text());
      setFileName(file.name); setBackupPayload(payload); setConfirmation(""); previewImport.mutate({ backup: payload });
    } catch { setFileName(""); setBackupPayload(null); toast.error("تعذر قراءة الملف. اختر ملف JSON صالحًا."); }
  };

  const preview = previewImport.data;
  return <div className="space-y-6">
    <section><p className="eyebrow">حماية البيانات</p><h1 className="page-title">النسخ الاحتياطي والاستعادة</h1><p className="page-subtitle">نزّل نسخة JSON مفهومة لكل بيانات المخزن، أو ارفع نسخة لمعاينتها ودمج البيانات الأساسية بعد تأكيدك.</p></section>
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="panel p-6"><div className="flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#E7F3FE] text-[#0178D4]"><Download className="h-5 w-5" /></div><div><p className="eyebrow">نسخة احتياطية</p><h2 className="mt-1 text-lg font-bold text-[#0B2E4E]">تنزيل كل البيانات بصيغة JSON</h2><p className="mt-2 text-sm leading-6 text-slate-500">يشمل الدليل والمخزون والطلبات والفواتير والصيانة والشراء والتجميع وسجل الحركة. لا يشمل كلمات المرور أو الجلسات أو الأسرار.</p></div></div><Button onClick={downloadBackup} disabled={downloadQuery.isFetching} className="mt-6 w-full gap-2 bg-[#0178D4] text-white hover:bg-[#0065B3]"><DatabaseBackup className="h-4 w-4" />{downloadQuery.isFetching ? "يجري تجهيز الملف…" : "تنزيل النسخة الاحتياطية JSON"}</Button></div>
      <div className="panel p-6"><div className="flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#E7F8F4] text-[#008E7A]"><Upload className="h-5 w-5" /></div><div><p className="eyebrow">استيراد مضبوط</p><h2 className="mt-1 text-lg font-bold text-[#0B2E4E]">رفع نسخة JSON للمراجعة</h2><p className="mt-2 text-sm leading-6 text-slate-500">لا يكتب الرفع أي بيانات فورًا. نعرض الأعداد والتحذيرات أولًا ثم نطلب عبارة تأكيد واضحة.</p></div></div><div className="mt-6"><Label htmlFor="backup-file">اختر ملف النسخة الاحتياطية</Label><Input id="backup-file" type="file" accept="application/json,.json" className="mt-2 cursor-pointer" onChange={selectBackupFile} /><p className="mt-2 text-xs text-slate-500">الحد الأقصى 10 ميغابايت. لا ترفع ملفات تحوي كلمات مرور أو مفاتيح.</p></div></div>
    </section>
    {fileName && <section className="panel overflow-hidden"><div className="border-b border-[#E8EEF3] p-6"><div className="flex flex-wrap items-center gap-3"><FileJson2 className="h-5 w-5 text-[#0178D4]" /><div><p className="font-semibold text-[#0B2E4E]">معاينة الملف: {fileName}</p><p className="mt-1 text-xs text-slate-500">لم تُكتب أي بيانات في المخزن حتى الآن.</p></div>{preview?.valid ? <span className="mr-auto inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />ملف صالح للمعاينة</span> : preview && <span className="mr-auto inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"><ShieldAlert className="h-3.5 w-3.5" />يحتاج إصلاح</span>}</div></div>{previewImport.isPending && <div className="p-6 text-sm text-slate-500">يجري التحقق من بنية الملف…</div>}{preview && <div className="space-y-6 p-6">{preview.errors.length > 0 && <WarningList tone="error" title="أخطاء تمنع الاستيراد" values={preview.errors} />}{preview.warnings.length > 0 && <WarningList tone="warning" title="تنبيهات قبل الاستيراد" values={preview.warnings} />}<div className="grid gap-4 md:grid-cols-2"><CountList title="بيانات أساسية يمكن دمجها" values={preview.supportedImportCounts} /><CountList title="سجلات تشغيلية تبقى للقراءة فقط" values={preview.skippedOperationalCounts} /></div>{preview.valid && <div className="rounded-xl border border-[#d9c79d] bg-[#fcf8ef] p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#a97937]" /><div><p className="font-semibold text-[#5d421d]">تأكيد دمج البيانات الأساسية</p><p className="mt-1 text-sm leading-6 text-[#765e3e]">سيضيف أو يحدّث الأقسام والموظفين غير المرتبطين بالحسابات والتصنيفات والأنواع والشركات والأصناف وقائمة المكونات. لن يغير الأرصدة أو الطلبات أو الفواتير أو السجل التشغيلي.</p><Label htmlFor="backup-confirmation" className="mt-4 block text-[#5d421d]">اكتب <span className="font-mono">MERGE_MASTER_DATA</span> للتأكيد</Label><Input id="backup-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 max-w-md bg-white font-mono" placeholder="MERGE_MASTER_DATA" /><Button disabled={confirmation !== "MERGE_MASTER_DATA" || importMaster.isPending || !backupPayload} onClick={() => backupPayload && importMaster.mutate({ backup: backupPayload, confirmation: "MERGE_MASTER_DATA" })} className="mt-4 gap-2 bg-[#a97937] text-white hover:bg-[#91642d]"><Upload className="h-4 w-4" />{importMaster.isPending ? "يجري الدمج…" : "تأكيد دمج البيانات الأساسية"}</Button></div></div></div>}</div>}</section>}
  </div>;
}

function WarningList({ title, values, tone }: { title: string; values: string[]; tone: "warning" | "error" }) { const styles = tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"; return <div className={`rounded-xl border p-4 ${styles}`}><p className="font-semibold">{title}</p><ul className="mt-2 space-y-1 text-sm">{values.map(value => <li key={value}>• {value}</li>)}</ul></div>; }
function CountList({ title, values }: { title: string; values: Record<string, number> }) { return <div className="rounded-xl border border-[#E8EEF3] p-4"><p className="font-semibold text-[#0B2E4E]">{title}</p><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(values).map(([key, value]) => <div key={key} className="rounded-lg bg-[#F7FAFC] px-3 py-2"><p className="truncate text-xs text-slate-500">{key}</p><p className="mt-1 text-base font-bold text-[#0B2E4E]">{value}</p></div>)}</div></div>; }
