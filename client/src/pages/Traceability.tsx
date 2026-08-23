import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import JsBarcode from "jsbarcode";
import { Barcode, Boxes, ClipboardList, History, MapPin, PackagePlus, Printer, QrCode, ScanBarcode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const statusLabel: Record<string, string> = {
  in_stock: "داخل المخزن", in_custody: "عُهدة", in_maintenance: "صيانة", in_production: "تحت التشغيل",
  installed: "مركّب", retired: "متقاعد", cannibalized: "تم تشليحه", scrapped: "تالف",
};

function BarcodeArt({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    JsBarcode(ref.current, value, { format: "CODE128", width: 1.35, height: 38, displayValue: false, margin: 0, lineColor: "#0B2E4E" });
  }, [value]);
  return <svg ref={ref} className="h-10 max-w-full" aria-label={`باركود ${value}`} />;
}

function PrintLabel({ name, subtitle, barcode, kind }: { name: string; subtitle: string; barcode: string; kind: "part" | "location" }) {
  const payload = `RTWMS:${kind.toUpperCase()}:${encodeURIComponent(barcode)}`;
  return <article className="label-card flex min-h-44 flex-col justify-between rounded-xl border-2 border-[#0B2E4E] bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold tracking-[.12em] text-[#A97937]">REVERSE TECH · WMS</p><h3 className="mt-1 line-clamp-2 text-sm font-extrabold text-[#0B2E4E]">{name}</h3><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p></div><QRCodeSVG value={payload} size={56} level="M" includeMargin={false} /></div>
    <div className="mt-3 overflow-hidden"><BarcodeArt value={barcode} /><p dir="ltr" className="mt-1 truncate text-center font-mono text-[9px] font-semibold tracking-[.08em] text-slate-700">{barcode}</p></div>
  </article>;
}

export default function Traceability() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: parts = [] } = trpc.traceability.labels.parts.useQuery();
  const { data: locations = [] } = trpc.traceability.locations.list.useQuery();
  const { data: assets = [], isLoading: assetsLoading } = trpc.traceability.serialAssets.list.useQuery();
  const [labelKind, setLabelKind] = useState<"parts" | "locations">("parts");
  const [labelSearch, setLabelSearch] = useState("");
  const [scannerValue, setScannerValue] = useState("");
  const lookup = trpc.traceability.lookup.useQuery({ barcode: scannerValue || "RTWMS" }, { enabled: false });
  const [locationDialog, setLocationDialog] = useState(false);
  const [serialDialog, setSerialDialog] = useState(false);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);
  const { data: history = [] } = trpc.traceability.serialAssets.history.useQuery({ id: historyAssetId ?? 0 }, { enabled: Boolean(historyAssetId) });
  const [locationForm, setLocationForm] = useState({ code: "", name: "", shelf: "", drawer: "", box: "", notes: "" });
  const [serialForm, setSerialForm] = useState({ partId: "", serialNumber: "", manufacturerSerial: "", locationId: "none", assetCondition: "", notes: "" });
  const createLocation = trpc.traceability.locations.create.useMutation({
    onSuccess: async () => { toast.success("تم إنشاء موقع التخزين وملصقه."); setLocationDialog(false); setLocationForm({ code: "", name: "", shelf: "", drawer: "", box: "", notes: "" }); await utils.traceability.locations.list.invalidate(); await utils.traceability.labels.locations.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const registerSerial = trpc.traceability.serialAssets.register.useMutation({
    onSuccess: async () => { toast.success("تم تسجيل الوحدة التسلسلية."); setSerialDialog(false); setSerialForm({ partId: "", serialNumber: "", manufacturerSerial: "", locationId: "none", assetCondition: "", notes: "" }); await utils.traceability.serialAssets.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const assignBarcode = trpc.traceability.parts.assignBarcode.useMutation({
    onSuccess: async () => { toast.success("تم تجهيز باركود الصنف."); await utils.traceability.labels.parts.invalidate(); await utils.warehouse.inventory.list.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const filteredLabels = useMemo(() => {
    const query = labelSearch.trim().toLowerCase();
    const collection = labelKind === "parts" ? parts : locations;
    if (!query) return collection;
    return collection.filter((item: any) => `${item.name} ${item.code ?? item.partNumber} ${item.barcode}`.toLowerCase().includes(query));
  }, [labelKind, labelSearch, parts, locations]);
  const serialTrackedParts = parts.filter(part => part.serialTrackingMode === "serial");

  const runLookup = async () => {
    if (!scannerValue.trim()) return toast.error("أدخل الباركود أو الرقم التسلسلي.");
    const result = await lookup.refetch();
    if (!result.data) return toast.error("لا توجد نتيجة مطابقة في المخزن.");
    const record = result.data;
    toast.success(record.kind === "part" ? `تم العثور على الصنف: ${record.part.name}` : record.kind === "location" ? `تم العثور على الموقع: ${record.location.name}` : `تم العثور على الوحدة: ${record.asset.serialNumber}`);
  };

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">التعريف والتتبع</p><h1 className="page-title">باركود، QR والوحدات التسلسلية</h1><p className="page-subtitle">اطبع ملصقات الأصناف والمواقع، وابحث بقارئ الباركود، وسجل كل بوردة أو جهاز يحتاج تتبعًا فرديًا دون تعديل تلقائي للأرصدة.</p></div>{isAdmin && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocationDialog(true)} className="gap-2"><MapPin className="h-4 w-4 text-[#0178D4]" />موقع تخزين</Button><Button onClick={() => setSerialDialog(true)} className="gap-2 bg-[#0178D4] text-white hover:bg-[#0065B3]"><PackagePlus className="h-4 w-4" />وحدة تسلسلية</Button></div>}</section>

    <section className="panel p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><Label className="mb-2 flex items-center gap-2"><ScanBarcode className="h-4 w-4 text-[#0178D4]" />بحث مباشر بالماسح أو الإدخال اليدوي</Label><div className="flex gap-2"><Input dir="ltr" value={scannerValue} onChange={event => setScannerValue(event.target.value)} onKeyDown={event => event.key === "Enter" && void runLookup()} placeholder="RTWMS-P-… أو الرقم التسلسلي" /><Button onClick={() => void runLookup()} disabled={lookup.isFetching} className="shrink-0">بحث</Button></div></div><div className="rounded-lg border border-[#E8EEF3] bg-[#F7FBFF] px-4 py-3 text-xs leading-5 text-slate-600">لا يحفظ الماسح أي بيانات جديدة: يطابق فقط رمز الصنف أو الموقع أو الرقم التسلسلي المسجل.</div></div></section>

    <section className="grid gap-6 xl:grid-cols-[1.08fr_.92fr]"><div className="panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#E8EEF3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-heading text-lg font-bold text-[#0B2E4E]">ملصقات جاهزة للطباعة</h2><p className="mt-1 text-sm text-slate-500">QR يشير إلى معرّف داخلي آمن، والباركود مناسب لقارئ Code 128.</p></div><div className="flex gap-2"><Button size="sm" variant={labelKind === "parts" ? "default" : "outline"} onClick={() => setLabelKind("parts")}>الأصناف</Button><Button size="sm" variant={labelKind === "locations" ? "default" : "outline"} onClick={() => setLabelKind("locations")}>المواقع</Button><Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="h-3.5 w-3.5" />طباعة</Button></div></div><div className="p-4"><Input value={labelSearch} onChange={event => setLabelSearch(event.target.value)} placeholder="ابحث عن ملصق بالاسم أو الكود…" className="mb-4 bg-white" /><div className="label-sheet grid gap-3 sm:grid-cols-2">{filteredLabels.slice(0, 24).map((item: any) => <PrintLabel key={item.id} name={item.name} subtitle={labelKind === "parts" ? `${item.partNumber} · ${item.category}` : `${item.code}${item.shelf ? ` · رف ${item.shelf}` : ""}`} barcode={item.barcode} kind={labelKind === "parts" ? "part" : "location"} />)}</div>{!filteredLabels.length && <div className="py-12 text-center text-sm text-slate-500">لا توجد ملصقات مطابقة حاليًا.</div>}</div></div>

      <div className="panel overflow-hidden"><div className="border-b border-[#E8EEF3] p-4"><h2 className="font-heading text-lg font-bold text-[#0B2E4E]">الأصناف التي تحتاج ملصقًا</h2><p className="mt-1 text-sm text-slate-500">لا يتم توليد باركود للسجلات القديمة تلقائيًا؛ جهزه من هنا عند المراجعة.</p></div><div className="max-h-[510px] divide-y divide-[#E8EEF3] overflow-y-auto">{parts.filter(part => !part.barcode).map(part => <div key={part.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-semibold text-[#0B2E4E]">{part.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{part.partNumber}</p></div>{isAdmin && <Button size="sm" variant="outline" onClick={() => assignBarcode.mutate({ partId: part.id })} disabled={assignBarcode.isPending} className="gap-1.5"><Barcode className="h-3.5 w-3.5" />إنشاء</Button>}</div>)}{!parts.filter(part => !part.barcode).length && <div className="p-10 text-center text-sm text-emerald-700">كل الأصناف المعروضة لها باركود.</div>}</div></div></section>

    <section className="panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#E8EEF3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-heading text-lg font-bold text-[#0B2E4E]">الوحدات والأجهزة ذات الرقم التسلسلي</h2><p className="mt-1 text-sm text-slate-500">يتغير سجل الوحدة وحالتها فقط؛ الرصيد الكمي للصنف لا يتغير بمجرد التسجيل.</p></div><Badge variant="outline" className="w-fit border-[#B9DAF7] bg-[#F1F8FE] text-[#0B5798]">{assets.length} وحدة مسجلة</Badge></div><div className="overflow-x-auto"><table className="min-w-[940px] w-full text-right"><thead className="bg-[#F7FBFF] text-[11px] font-bold tracking-[.08em] text-slate-500"><tr><th className="px-5 py-3">الوحدة</th><th className="px-4 py-3">الصنف</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">الموقع / الحائز</th><th className="px-4 py-3">الحالة الفنية</th><th className="px-5 py-3 text-left">السجل</th></tr></thead><tbody className="divide-y divide-[#E8EEF3]">{assets.map(row => <tr key={row.asset.id}><td className="px-5 py-4"><p dir="ltr" className="font-mono text-sm font-bold text-[#0B2E4E]">{row.asset.serialNumber}</p>{row.asset.manufacturerSerial && <p dir="ltr" className="mt-1 text-xs text-slate-500">MFG: {row.asset.manufacturerSerial}</p>}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{row.part.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{row.part.partNumber}</p></td><td className="px-4 py-4"><Badge variant="outline" className="border-[#B9DAF7] bg-[#F1F8FE] text-[#0B5798]">{statusLabel[row.asset.status]}</Badge></td><td className="px-4 py-4 text-sm text-slate-600">{row.holder?.name ? `مع ${row.holder.name}` : row.location?.name ?? "غير محدد"}</td><td className="px-4 py-4 text-sm text-slate-600">{row.asset.assetCondition ?? "غير محددة"}</td><td className="px-5 py-4 text-left"><Button variant="ghost" size="icon" onClick={() => setHistoryAssetId(row.asset.id)} aria-label="عرض سجل الوحدة"><History className="h-4 w-4" /></Button></td></tr>)}{!assetsLoading && !assets.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">لا توجد وحدات تسلسلية مسجلة بعد.</td></tr>}</tbody></table></div></section>

    <Dialog open={locationDialog} onOpenChange={setLocationDialog}><DialogContent><DialogHeader><DialogTitle>إضافة موقع تخزين</DialogTitle><DialogDescription>ينشئ النظام باركودًا فريدًا للموقع بعد الحفظ.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="رمز الموقع"><Input dir="ltr" value={locationForm.code} onChange={event => setLocationForm(current => ({ ...current, code: event.target.value }))} placeholder="A-01-D02" /></Field><Field label="اسم الموقع"><Input value={locationForm.name} onChange={event => setLocationForm(current => ({ ...current, name: event.target.value }))} placeholder="رف القطع الدقيقة" /></Field><Field label="رف"><Input value={locationForm.shelf} onChange={event => setLocationForm(current => ({ ...current, shelf: event.target.value }))} /></Field><Field label="درج / صندوق"><Input value={locationForm.drawer} onChange={event => setLocationForm(current => ({ ...current, drawer: event.target.value }))} /></Field></div><Field label="ملاحظات" className="mt-4"><Textarea value={locationForm.notes} onChange={event => setLocationForm(current => ({ ...current, notes: event.target.value }))} /></Field><DialogFooter><Button variant="outline" onClick={() => setLocationDialog(false)}>إلغاء</Button><Button disabled={createLocation.isPending || !locationForm.code.trim() || !locationForm.name.trim()} onClick={() => createLocation.mutate(locationForm)}>حفظ الموقع</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={serialDialog} onOpenChange={setSerialDialog}><DialogContent><DialogHeader><DialogTitle>تسجيل وحدة تسلسلية</DialogTitle><DialogDescription>اختر صنفًا فُعّل له التتبع التسلسلي. التسجيل نفسه لا يغير كمية المخزون.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="الصنف"><Select value={serialForm.partId} onValueChange={value => setSerialForm(current => ({ ...current, partId: value }))}><SelectTrigger><SelectValue placeholder="اختر صنفًا" /></SelectTrigger><SelectContent>{serialTrackedParts.map(part => <SelectItem key={part.id} value={String(part.id)}>{part.name} · {part.partNumber}</SelectItem>)}</SelectContent></Select></Field><Field label="الرقم التسلسلي"><Input dir="ltr" value={serialForm.serialNumber} onChange={event => setSerialForm(current => ({ ...current, serialNumber: event.target.value }))} /></Field><Field label="رقم المصنع"><Input dir="ltr" value={serialForm.manufacturerSerial} onChange={event => setSerialForm(current => ({ ...current, manufacturerSerial: event.target.value }))} /></Field><Field label="موقع البدء"><Select value={serialForm.locationId} onValueChange={value => setSerialForm(current => ({ ...current, locationId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير محدد حاليًا</SelectItem>{locations.filter(location => location.isActive).map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name} · {location.code}</SelectItem>)}</SelectContent></Select></Field></div><Field label="الحالة الفنية" className="mt-4"><Input value={serialForm.assetCondition} onChange={event => setSerialForm(current => ({ ...current, assetCondition: event.target.value }))} placeholder="سليم / تحت الفحص…" /></Field><Field label="ملاحظات" className="mt-4"><Textarea value={serialForm.notes} onChange={event => setSerialForm(current => ({ ...current, notes: event.target.value }))} /></Field><DialogFooter><Button variant="outline" onClick={() => setSerialDialog(false)}>إلغاء</Button><Button disabled={registerSerial.isPending || !serialForm.partId || !serialForm.serialNumber.trim()} onClick={() => registerSerial.mutate({ partId: Number(serialForm.partId), serialNumber: serialForm.serialNumber, manufacturerSerial: serialForm.manufacturerSerial || undefined, locationId: serialForm.locationId === "none" ? null : Number(serialForm.locationId), assetCondition: serialForm.assetCondition || undefined, notes: serialForm.notes || undefined })}>تسجيل الوحدة</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(historyAssetId)} onOpenChange={open => !open && setHistoryAssetId(null)}><DialogContent><DialogHeader><DialogTitle>سجل الوحدة التسلسلية</DialogTitle><DialogDescription>سجل زمني للانتقالات المسجلة؛ لا يمكن تعديله من هذه الشاشة.</DialogDescription></DialogHeader><div className="max-h-80 space-y-3 overflow-y-auto">{history.map(row => <div key={row.event.id} className="rounded-lg border border-[#E8EEF3] bg-[#F7FBFF] p-3"><div className="flex justify-between gap-3"><Badge variant="outline">{statusLabel[row.event.toStatus ?? ""] ?? row.event.type}</Badge><span className="text-xs text-slate-500">{new Date(row.event.createdAt).toLocaleString("ar-EG")}</span></div><p className="mt-2 text-sm text-slate-700">{row.event.note ?? "تحديث حالة الوحدة"}</p>{row.actor?.name && <p className="mt-1 text-xs text-slate-500">بواسطة: {row.actor.name}</p>}</div>)}{!history.length && <p className="py-8 text-center text-sm text-slate-500">لا توجد أحداث مسجلة بعد.</p>}</div><DialogFooter><Button onClick={() => setHistoryAssetId(null)}>إغلاق</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}
