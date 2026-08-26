import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { exportReportExcel } from "@/lib/reportExport";
import { trpc } from "@/lib/trpc";
import { Box, Download, Factory, FilePlus2, Loader2, PackagePlus, Play, Printer, ScrollText, Settings2, Truck, Weight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type LabOrderRow = {
  order: { id: number; title: string; printerId: number | null; materialId: number | null; deliveredTo: string | null };
  printer: { name: string } | null;
  material: { name: string } | null;
};

const statusLabel: Record<string, string> = {
  available: "متاحة",
  printing: "تطبع الآن",
  maintenance: "صيانة",
  offline: "متوقفة",
  received: "وارد للمعمل",
  scheduled: "مجدول",
  completed: "مكتمل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusTone: Record<string, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  printing: "border-sky-200 bg-sky-50 text-sky-700",
  maintenance: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-slate-200 bg-slate-100 text-slate-600",
  received: "border-blue-200 bg-blue-50 text-blue-700",
  scheduled: "border-violet-200 bg-violet-50 text-violet-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-teal-200 bg-teal-50 text-teal-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

function localDateTimeInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function dateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function toIso(localValue: string) {
  return new Date(localValue).toISOString();
}

function MetricCard({ title, value, description, icon: Icon, accent = "text-[#0178D4]" }: { title: string; value: string | number; description: string; icon: typeof Printer; accent?: string }) {
  return <Card className="border-[#DCEAF7] shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-2 text-3xl font-extrabold text-[#0B2E4E]">{value}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div><div className={`grid h-12 w-12 place-items-center rounded-2xl bg-[#F1F8FE] ${accent}`}><Icon className="h-6 w-6" /></div></CardContent></Card>;
}

function AdminOnlyMessage() {
  return <Card className="mx-auto max-w-2xl border-amber-200 bg-amber-50"><CardContent className="p-8 text-center"><Factory className="mx-auto h-10 w-10 text-amber-700" /><h1 className="mt-4 text-xl font-extrabold text-[#0B2E4E]">معمل الطباعة ثلاثية الأبعاد</h1><p className="mt-2 leading-7 text-slate-600">هذه المساحة مخصصة للأدمن لمتابعة الطابعات والفيلمنت والأوامر وحركة الجرامات داخل المعمل.</p></CardContent></Card>;
}

export default function PrintLab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const enabled = user?.role === "admin";
  const { data, isLoading } = trpc.printLab.overview.useQuery(undefined, { enabled });
  const refresh = () => utils.printLab.overview.invalidate();
  const createPrinter = trpc.printLab.createPrinter.useMutation({ onSuccess: () => { toast.success("تمت إضافة الطابعة."); refresh(); }, onError: error => toast.error(error.message) });
  const setPrinterStatus = trpc.printLab.setPrinterStatus.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const createMaterial = trpc.printLab.createMaterial.useMutation({ onSuccess: () => { toast.success("تمت إضافة مادة الطباعة ورصيدها الافتتاحي."); refresh(); }, onError: error => toast.error(error.message) });
  const adjustMaterial = trpc.printLab.adjustMaterial.useMutation({ onSuccess: result => { toast.success(`تم تسجيل الحركة. الرصيد الآن ${result.availableGramsAfter} جم.`); refresh(); }, onError: error => toast.error(error.message) });
  const createOrder = trpc.printLab.createOrder.useMutation({ onSuccess: result => { toast.success(`تم تسجيل الأمر ${result.orderNumber}.`); refresh(); }, onError: error => toast.error(error.message) });
  const startOrder = trpc.printLab.startOrder.useMutation({ onSuccess: () => { toast.success("بدأت الطباعة وتم تحديث حالة الطابعة."); refresh(); }, onError: error => toast.error(error.message) });
  const logRun = trpc.printLab.logRun.useMutation({ onSuccess: result => { toast.success(`سُجل التشغيل. المتبقي ${result.availableGramsAfter} جم.`); refresh(); }, onError: error => toast.error(error.message) });
  const completeOrder = trpc.printLab.completeOrder.useMutation({ onSuccess: () => { toast.success("تم إنهاء الطباعة وإتاحة الطابعة."); refresh(); }, onError: error => toast.error(error.message) });
  const deliverOrder = trpc.printLab.deliverOrder.useMutation({ onSuccess: () => { toast.success("تم توثيق خروج الطلب من المعمل."); refresh(); }, onError: error => toast.error(error.message) });

  const [printerForm, setPrinterForm] = useState({ name: "", model: "", location: "", notes: "" });
  const [materialForm, setMaterialForm] = useState({ name: "", materialType: "PLA", color: "", spoolCode: "", initialGrams: "0", minimumGrams: "0", notes: "" });
  const [orderForm, setOrderForm] = useState({ title: "", receivedFrom: "", deliveredTo: "", printerId: "", materialId: "", expectedGrams: "0", notes: "" });
  const [movementForm, setMovementForm] = useState({ materialId: "", type: "inbound" as "inbound" | "returned" | "adjustment_in" | "adjustment_out", grams: "", reason: "", occurredAt: localDateTimeInput() });
  const [runOrder, setRunOrder] = useState<LabOrderRow | null>(null);
  const [runForm, setRunForm] = useState({ gramsUsed: "", startedAt: localDateTimeInput(), endedAt: "", notes: "" });
  const [deliveryOrder, setDeliveryOrder] = useState<LabOrderRow | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState("");

  const dailyConsumed = useMemo(() => {
    const today = new Date().toDateString();
    return data?.movements.filter(row => row.movement.type === "consumed" && new Date(row.movement.occurredAt).toDateString() === today).reduce((total, row) => total + Math.abs(row.movement.gramsDelta), 0) ?? 0;
  }, [data?.movements]);
  const remainingGrams = data?.materials.reduce((total, material) => total + material.availableGrams, 0) ?? 0;
  const activeOrders = data?.orders.filter(row => ["received", "scheduled", "printing", "completed"].includes(row.order.status)).length ?? 0;
  const activePrinters = data?.printers.filter(printer => printer.status === "printing").length ?? 0;

  if (!enabled) return <AdminOnlyMessage />;
  if (isLoading || !data) return <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0178D4]" /></div>;

  const submitPrinter = (event: React.FormEvent) => {
    event.preventDefault();
    createPrinter.mutate(printerForm);
    setPrinterForm({ name: "", model: "", location: "", notes: "" });
  };
  const submitMaterial = (event: React.FormEvent) => {
    event.preventDefault();
    createMaterial.mutate({ ...materialForm, initialGrams: numeric(materialForm.initialGrams), minimumGrams: numeric(materialForm.minimumGrams) });
    setMaterialForm({ name: "", materialType: "PLA", color: "", spoolCode: "", initialGrams: "0", minimumGrams: "0", notes: "" });
  };
  const submitOrder = (event: React.FormEvent) => {
    event.preventDefault();
    createOrder.mutate({ ...orderForm, printerId: orderForm.printerId ? Number(orderForm.printerId) : undefined, materialId: orderForm.materialId ? Number(orderForm.materialId) : undefined, expectedGrams: numeric(orderForm.expectedGrams) });
    setOrderForm({ title: "", receivedFrom: "", deliveredTo: "", printerId: "", materialId: "", expectedGrams: "0", notes: "" });
  };
  const submitMovement = (event: React.FormEvent) => {
    event.preventDefault();
    adjustMaterial.mutate({ materialId: Number(movementForm.materialId), type: movementForm.type, grams: numeric(movementForm.grams), reason: movementForm.reason, occurredAt: toIso(movementForm.occurredAt) });
    setMovementForm(current => ({ ...current, grams: "", reason: "", occurredAt: localDateTimeInput() }));
  };
  const submitRun = (event: React.FormEvent) => {
    event.preventDefault();
    if (!runOrder?.order.printerId || !runOrder.order.materialId) return;
    logRun.mutate({ orderId: runOrder.order.id, printerId: runOrder.order.printerId, materialId: runOrder.order.materialId, gramsUsed: numeric(runForm.gramsUsed), startedAt: toIso(runForm.startedAt), endedAt: runForm.endedAt ? toIso(runForm.endedAt) : undefined, notes: runForm.notes });
    setRunOrder(null);
    setRunForm({ gramsUsed: "", startedAt: localDateTimeInput(), endedAt: "", notes: "" });
  };
  const submitDelivery = (event: React.FormEvent) => {
    event.preventDefault();
    if (!deliveryOrder) return;
    deliverOrder.mutate({ id: deliveryOrder.order.id, deliveredTo: deliveryTarget });
    setDeliveryOrder(null);
    setDeliveryTarget("");
  };

  const exportOrders = () => void exportReportExcel("أوامر معمل الطباعة ثلاثية الأبعاد", "reverse-tech-3d-print-orders", [
    { label: "رقم الأمر", value: row => row.order.orderNumber },
    { label: "اسم الأمر", value: row => row.order.title },
    { label: "الحالة", value: row => statusLabel[row.order.status] ?? row.order.status },
    { label: "الطابعة", value: row => row.printer?.name },
    { label: "الفيلمنت", value: row => row.material ? `${row.material.name} · ${row.material.materialType}` : null },
    { label: "المتوقع (جم)", value: row => row.order.expectedGrams },
    { label: "المستهلك (جم)", value: row => row.order.actualGramsUsed },
    { label: "داخل من", value: row => row.order.receivedFrom },
    { label: "خارج إلى", value: row => row.order.deliveredTo },
    { label: "تاريخ التسجيل", value: row => dateTime(row.order.createdAt) },
    { label: "وقت التسليم", value: row => dateTime(row.order.deliveredAt) },
  ], data.orders);
  const exportMovements = () => void exportReportExcel("سجل حركة فيلمنت معمل الطباعة", "reverse-tech-3d-print-filament", [
    { label: "التاريخ والوقت", value: row => dateTime(row.movement.occurredAt) },
    { label: "الحركة", value: row => row.movement.type === "consumed" ? "خارج للطباعة" : row.movement.type === "inbound" ? "داخل للمعمل" : row.movement.type === "returned" ? "مرتجع للمعمل" : row.movement.type === "adjustment_in" ? "تسوية داخل" : "تسوية خارج" },
    { label: "الفيلمنت", value: row => `${row.material.name} · ${row.material.materialType}` },
    { label: "التغير (جم)", value: row => row.movement.gramsDelta },
    { label: "الرصيد قبل", value: row => row.movement.gramsBefore },
    { label: "الرصيد بعد", value: row => row.movement.gramsAfter },
    { label: "الأمر", value: row => row.order?.orderNumber },
    { label: "الطابعة", value: row => row.printer?.name },
    { label: "السبب", value: row => row.movement.reason },
  ], data.movements);
  const exportRuns = () => void exportReportExcel("سجل تشغيل طابعات معمل الطباعة", "reverse-tech-3d-printer-runs", [
    { label: "الطابعة", value: row => row.printer.name },
    { label: "رقم الأمر", value: row => row.order?.orderNumber },
    { label: "اسم الأمر", value: row => row.order?.title },
    { label: "الفيلمنت", value: row => `${row.material.name} · ${row.material.materialType}` },
    { label: "المستهلك (جم)", value: row => row.run.gramsUsed },
    { label: "بداية التشغيل", value: row => dateTime(row.run.startedAt) },
    { label: "نهاية التشغيل", value: row => dateTime(row.run.endedAt) },
    { label: "ملاحظات التشغيل", value: row => row.run.notes },
  ], data.runs);

  return <div className="space-y-6" dir="rtl">
    <section className="relative overflow-hidden rounded-2xl border border-[#DCEAF7] bg-gradient-to-l from-[#0B2E4E] via-[#0E4673] to-[#0178D4] p-6 text-white shadow-[0_18px_34px_rgba(11,46,78,.16)] sm:p-8">
      <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full border border-white/15" /><div className="absolute bottom-0 left-20 h-24 w-24 rounded-t-full border border-white/10" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2 text-sm font-bold text-[#CDE8FA]"><Factory className="h-4 w-4" />وحدة تشغيل مستقلة للأدمن</div><h1 className="mt-3 text-3xl font-extrabold">معمل الطباعة ثلاثية الأبعاد</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-[#DDEFFC]">تابع ما يدخل المعمل وما يخرج منه، والطابعة التي تعمل على كل أمر، ونوع الفيلمنت والجرامات المستهلكة بسجل يومي واضح.</p></div><div className="flex flex-wrap gap-2"><Button onClick={exportOrders} className="bg-white text-[#0B2E4E] hover:bg-[#E7F3FE]"><Download className="ml-2 h-4 w-4" />Excel للأوامر</Button><Button variant="outline" onClick={exportRuns} className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Printer className="ml-2 h-4 w-4" />Excel لتشغيل الطابعات</Button><Button variant="outline" onClick={exportMovements} className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"><ScrollText className="ml-2 h-4 w-4" />Excel لحركة الجرامات</Button></div></div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard title="طابعات تعمل الآن" value={activePrinters} description="مرتبطة بأوامر قيد الطباعة" icon={Printer} /><MetricCard title="أوامر تحتاج متابعة" value={activeOrders} description="من الاستلام حتى التسليم" icon={FilePlus2} accent="text-violet-600" /><MetricCard title="رصيد الفيلمنت" value={`${remainingGrams} جم`} description="إجمالي الرصيد المتاح" icon={Weight} accent="text-emerald-600" /><MetricCard title="استهلاك اليوم" value={`${dailyConsumed} جم`} description="مسجل في سجل التشغيل اليومي" icon={Box} accent="text-amber-600" /></section>

    <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><Card className="border-[#DCEAF7]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><FilePlus2 className="h-5 w-5 text-[#0178D4]" />أمر طباعة جديد</CardTitle><CardDescription>يسجل دخول المهمة للمعمل والطابعة والفيلمنت والوزن المتوقع بالجرام.</CardDescription></CardHeader><CardContent><form onSubmit={submitOrder} className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label>اسم الأمر</Label><Input className="mt-2" value={orderForm.title} onChange={event => setOrderForm({ ...orderForm, title: event.target.value })} placeholder="مثال: حامل جهاز فوتوثيرابي" required /></div><div><Label>دخل من / طالب الأمر</Label><Input className="mt-2" value={orderForm.receivedFrom} onChange={event => setOrderForm({ ...orderForm, receivedFrom: event.target.value })} placeholder="اسم القسم أو الموظف" /></div><div><Label>خارج إلى</Label><Input className="mt-2" value={orderForm.deliveredTo} onChange={event => setOrderForm({ ...orderForm, deliveredTo: event.target.value })} placeholder="المستلم المتوقع" /></div><div><Label>الطابعة</Label><Select value={orderForm.printerId || undefined} onValueChange={printerId => setOrderForm({ ...orderForm, printerId })}><SelectTrigger className="mt-2"><SelectValue placeholder="عيّن طابعة لاحقًا" /></SelectTrigger><SelectContent>{data.printers.map(printer => <SelectItem key={printer.id} value={String(printer.id)}>{printer.name} · {statusLabel[printer.status]}</SelectItem>)}</SelectContent></Select></div><div><Label>الفيلمنت</Label><Select value={orderForm.materialId || undefined} onValueChange={materialId => setOrderForm({ ...orderForm, materialId })}><SelectTrigger className="mt-2"><SelectValue placeholder="عيّن مادة لاحقًا" /></SelectTrigger><SelectContent>{data.materials.filter(material => material.isActive).map(material => <SelectItem key={material.id} value={String(material.id)}>{material.name} · {material.availableGrams} جم</SelectItem>)}</SelectContent></Select></div><div><Label>الوزن المتوقع (جرام)</Label><Input className="mt-2" type="number" min="0" value={orderForm.expectedGrams} onChange={event => setOrderForm({ ...orderForm, expectedGrams: event.target.value })} /></div><div className="sm:col-span-2"><Label>ملاحظات التشغيل</Label><Textarea className="mt-2" value={orderForm.notes} onChange={event => setOrderForm({ ...orderForm, notes: event.target.value })} placeholder="مواصفات أو ملاحظات تسليم اختيارية" /></div><div className="sm:col-span-2"><Button type="submit" disabled={createOrder.isPending} className="w-full bg-[#0178D4] hover:bg-[#0B70B5]">{createOrder.isPending ? "يجري التسجيل…" : "تسجيل أمر داخل المعمل"}</Button></div></form></CardContent></Card>

      <Card className="border-[#DCEAF7]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><PackagePlus className="h-5 w-5 text-[#0178D4]" />إعدادات سريعة للمعمل</CardTitle><CardDescription>أضف طابعة أو مادة فيلمنت. الرصيد الافتتاحي يسجل تلقائيًا كحركة دخول موثقة.</CardDescription></CardHeader><CardContent className="space-y-6"><form onSubmit={submitPrinter} className="rounded-xl border border-[#E3EDF6] bg-[#FBFDFF] p-4"><p className="mb-3 flex items-center gap-2 font-bold text-[#0B2E4E]"><Printer className="h-4 w-4 text-[#0178D4]" />إضافة طابعة</p><div className="grid gap-3 sm:grid-cols-2"><Input value={printerForm.name} onChange={event => setPrinterForm({ ...printerForm, name: event.target.value })} placeholder="اسم الطابعة" required /><Input value={printerForm.model} onChange={event => setPrinterForm({ ...printerForm, model: event.target.value })} placeholder="الموديل (اختياري)" /><Input value={printerForm.location} onChange={event => setPrinterForm({ ...printerForm, location: event.target.value })} placeholder="مكانها في المعمل" /><Button type="submit" variant="outline" disabled={createPrinter.isPending}>إضافة الطابعة</Button></div></form><form onSubmit={submitMaterial} className="rounded-xl border border-[#E3EDF6] bg-[#FBFDFF] p-4"><p className="mb-3 flex items-center gap-2 font-bold text-[#0B2E4E]"><Weight className="h-4 w-4 text-[#0178D4]" />إضافة مادة طباعة</p><div className="grid gap-3 sm:grid-cols-2"><Input value={materialForm.name} onChange={event => setMaterialForm({ ...materialForm, name: event.target.value })} placeholder="اسم الفيلمنت" required /><Input value={materialForm.materialType} onChange={event => setMaterialForm({ ...materialForm, materialType: event.target.value })} placeholder="PLA / PETG / ABS" required /><Input value={materialForm.color} onChange={event => setMaterialForm({ ...materialForm, color: event.target.value })} placeholder="اللون" /><Input value={materialForm.spoolCode} onChange={event => setMaterialForm({ ...materialForm, spoolCode: event.target.value })} placeholder="كود البكرة" /><Input type="number" min="0" value={materialForm.initialGrams} onChange={event => setMaterialForm({ ...materialForm, initialGrams: event.target.value })} placeholder="رصيد افتتاحي بالجرام" /><Input type="number" min="0" value={materialForm.minimumGrams} onChange={event => setMaterialForm({ ...materialForm, minimumGrams: event.target.value })} placeholder="حد تنبيه بالجرام" /><Button type="submit" className="sm:col-span-2" variant="outline" disabled={createMaterial.isPending}>إضافة المادة والرصيد الافتتاحي</Button></div></form></CardContent></Card></section>

    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><Card className="border-[#DCEAF7]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><Printer className="h-5 w-5 text-[#0178D4]" />الطابعات وحالة التشغيل</CardTitle><CardDescription>الطابعة لا يمكن بدء أمر جديد عليها عندما تكون قيد طباعة أو في الصيانة.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{data.printers.length ? data.printers.map(printer => <div key={printer.id} className="rounded-xl border border-[#E3EDF6] p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-[#0B2E4E]">{printer.name}</p><p className="mt-1 text-xs text-slate-500">{[printer.model, printer.location].filter(Boolean).join(" · ") || "دون موديل أو موقع مسجل"}</p></div><Badge className={statusTone[printer.status]} variant="outline">{statusLabel[printer.status]}</Badge></div><Select value={printer.status} onValueChange={status => setPrinterStatus.mutate({ id: printer.id, status: status as "available" | "printing" | "maintenance" | "offline" })}><SelectTrigger className="mt-4 h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">متاحة</SelectItem><SelectItem value="maintenance">صيانة</SelectItem><SelectItem value="offline">متوقفة</SelectItem><SelectItem value="printing">تطبع الآن</SelectItem></SelectContent></Select></div>) : <p className="col-span-full py-8 text-center text-sm text-slate-500">أضف اسم أول طابعة لتظهر هنا.</p>}</CardContent></Card>
      <Card className="border-[#DCEAF7]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><Weight className="h-5 w-5 text-[#0178D4]" />حركة الفيلمنت</CardTitle><CardDescription>سجّل دخول رصيد جديد أو مرتجع أو تسوية. استهلاك الطباعة يسجل من سجل التشغيل فقط.</CardDescription></CardHeader><CardContent><form onSubmit={submitMovement} className="space-y-3"><Select value={movementForm.materialId || undefined} onValueChange={materialId => setMovementForm({ ...movementForm, materialId })}><SelectTrigger><SelectValue placeholder="اختر مادة الطباعة" /></SelectTrigger><SelectContent>{data.materials.filter(material => material.isActive).map(material => <SelectItem key={material.id} value={String(material.id)}>{material.name} · {material.availableGrams} جم</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Select value={movementForm.type} onValueChange={type => setMovementForm({ ...movementForm, type: type as typeof movementForm.type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inbound">دخول للمعمل</SelectItem><SelectItem value="returned">مرتجع للمعمل</SelectItem><SelectItem value="adjustment_in">تسوية بالزيادة</SelectItem><SelectItem value="adjustment_out">تسوية بالخروج</SelectItem></SelectContent></Select><Input type="number" min="1" value={movementForm.grams} onChange={event => setMovementForm({ ...movementForm, grams: event.target.value })} placeholder="الجرامات" required /></div><Input type="datetime-local" value={movementForm.occurredAt} onChange={event => setMovementForm({ ...movementForm, occurredAt: event.target.value })} required /><Textarea value={movementForm.reason} onChange={event => setMovementForm({ ...movementForm, reason: event.target.value })} placeholder="سبب الحركة" required /><Button type="submit" variant="outline" className="w-full" disabled={!movementForm.materialId || adjustMaterial.isPending}>تسجيل حركة الفيلمنت</Button></form></CardContent></Card></section>

    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Card className="border-[#DCEAF7]"><CardHeader><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><Factory className="h-5 w-5 text-[#0178D4]" />أوامر المعمل</CardTitle><CardDescription>من دخول الطلب وحتى خروجه للمستلم، مع متابعة الجرامات الفعلية.</CardDescription></CardHeader><CardContent className="space-y-3">{data.orders.length ? data.orders.map(row => <div key={row.order.id} className="rounded-xl border border-[#E3EDF6] bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-[#0B2E4E]">{row.order.title}</p><Badge variant="outline" className={statusTone[row.order.status]}>{statusLabel[row.order.status] ?? row.order.status}</Badge></div><p className="mt-1 font-mono text-xs text-[#0178D4]">{row.order.orderNumber}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>الطابعة: <b>{row.printer?.name ?? "غير محددة"}</b></span><span>الفيلمنت: <b>{row.material?.name ?? "غير محدد"}</b></span><span>المتوقع: <b>{row.order.expectedGrams} جم</b></span><span>المستهلك: <b>{row.order.actualGramsUsed} جم</b></span></div><p className="mt-2 text-xs text-slate-500">داخل من: {row.order.receivedFrom || "—"} · خارج إلى: {row.order.deliveredTo || "—"} · سُجل: {dateTime(row.order.createdAt)}</p></div><div className="flex flex-wrap gap-2 self-start">{(row.order.status === "received" || row.order.status === "scheduled") && <Button size="sm" onClick={() => startOrder.mutate({ id: row.order.id })} disabled={startOrder.isPending}><Play className="ml-1 h-3.5 w-3.5" />بدء الطباعة</Button>}{row.order.status === "printing" && <><Button size="sm" variant="outline" onClick={() => setRunOrder(row)}><ScrollText className="ml-1 h-3.5 w-3.5" />سجل تشغيل</Button><Button size="sm" onClick={() => completeOrder.mutate({ id: row.order.id })} disabled={completeOrder.isPending}>إنهاء الطباعة</Button></>}{row.order.status === "completed" && <Button size="sm" onClick={() => { setDeliveryOrder(row); setDeliveryTarget(row.order.deliveredTo ?? ""); }}><Truck className="ml-1 h-3.5 w-3.5" />تسليم وخروج</Button>}</div></div></div>) : <p className="py-10 text-center text-sm text-slate-500">لا توجد أوامر طباعة بعد. سجل أول أمر كـ «داخل للمعمل» من النموذج أعلاه.</p>}</CardContent></Card>
      <Card className="border-[#DCEAF7]"><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-[#0B2E4E]"><Settings2 className="h-5 w-5 text-[#0178D4]" />سجل التشغيل اليومي</CardTitle><CardDescription className="mt-1">كل صف يمثل تشغيلًا موثقًا وخصمًا فعليًا بالجرام من الفيلمنت.</CardDescription></div><Button variant="outline" size="sm" onClick={exportRuns}><Download className="ml-1 h-4 w-4" />Excel</Button></CardHeader><CardContent className="space-y-3">{data.runs.length ? data.runs.slice(0, 8).map(row => <div key={row.run.id} className="border-b border-[#EEF4F8] pb-3 last:border-0"><p className="font-bold text-[#0B2E4E]">{row.order?.title ?? "تشغيل بلا اسم أمر"}</p><p className="mt-1 text-xs text-slate-600">{row.printer.name} · {row.material.name} · <b>{row.run.gramsUsed} جم</b></p><p className="mt-1 text-[11px] text-slate-500">{dateTime(row.run.startedAt)} {row.run.endedAt ? `حتى ${dateTime(row.run.endedAt)}` : ""}</p></div>) : <p className="py-10 text-center text-sm text-slate-500">سجلات تشغيل اليوم ستظهر هنا بعد بدء أمر وتسجيل جراماته.</p>}</CardContent></Card></section>

    <Card className="border-[#DCEAF7]"><CardHeader className="flex-row items-center justify-between gap-4"><div><CardTitle className="text-[#0B2E4E]">سجل ما دخل وخرج من المعمل</CardTitle><CardDescription className="mt-1">سجل غير قابل للتعديل لحركة الفيلمنت بالجرام، مع وقت العملية والأمر والطابعة.</CardDescription></div><Button variant="outline" size="sm" onClick={exportMovements}><Download className="ml-1 h-4 w-4" />Excel</Button></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>الوقت</TableHead><TableHead>الحركة</TableHead><TableHead>المادة</TableHead><TableHead>الجرامات</TableHead><TableHead>قبل ← بعد</TableHead><TableHead>الأمر / الطابعة</TableHead><TableHead>السبب</TableHead></TableRow></TableHeader><TableBody>{data.movements.slice(0, 18).map(row => <TableRow key={row.movement.id}><TableCell className="whitespace-nowrap text-xs">{dateTime(row.movement.occurredAt)}</TableCell><TableCell><Badge variant="outline" className={row.movement.gramsDelta > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>{row.movement.gramsDelta > 0 ? "داخل" : "خارج"}</Badge></TableCell><TableCell>{row.material.name}</TableCell><TableCell className={row.movement.gramsDelta > 0 ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{row.movement.gramsDelta > 0 ? "+" : ""}{row.movement.gramsDelta} جم</TableCell><TableCell>{row.movement.gramsBefore} ← {row.movement.gramsAfter} جم</TableCell><TableCell className="text-xs">{row.order?.orderNumber ?? "—"}<br />{row.printer?.name ?? "—"}</TableCell><TableCell className="max-w-[260px] text-xs text-slate-600">{row.movement.reason}</TableCell></TableRow>)}{!data.movements.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-500">لا توجد حركة فيلمنت مسجلة بعد.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>

    <Dialog open={Boolean(runOrder)} onOpenChange={open => !open && setRunOrder(null)}><DialogContent><DialogHeader><DialogTitle>سجل تشغيل طابعة</DialogTitle><DialogDescription>يخصم هذا السجل الجرامات المدخلة مباشرة من رصيد الفيلمنت للأمر المحدد.</DialogDescription></DialogHeader><form onSubmit={submitRun} className="space-y-4"><div className="rounded-lg bg-[#F1F8FE] p-3 text-sm text-[#0B2E4E]"><b>{runOrder?.order.title}</b><br />{runOrder?.printer?.name} · {runOrder?.material?.name}</div><div><Label>الجرامات المستهلكة</Label><Input className="mt-2" type="number" min="1" value={runForm.gramsUsed} onChange={event => setRunForm({ ...runForm, gramsUsed: event.target.value })} required /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>بداية التشغيل</Label><Input className="mt-2" type="datetime-local" value={runForm.startedAt} onChange={event => setRunForm({ ...runForm, startedAt: event.target.value })} required /></div><div><Label>نهاية التشغيل</Label><Input className="mt-2" type="datetime-local" value={runForm.endedAt} onChange={event => setRunForm({ ...runForm, endedAt: event.target.value })} /></div></div><Textarea value={runForm.notes} onChange={event => setRunForm({ ...runForm, notes: event.target.value })} placeholder="ملاحظات تشغيل اختيارية" /><Button type="submit" className="w-full" disabled={logRun.isPending}>تسجيل الاستهلاك اليومي</Button></form></DialogContent></Dialog>
    <Dialog open={Boolean(deliveryOrder)} onOpenChange={open => !open && setDeliveryOrder(null)}><DialogContent><DialogHeader><DialogTitle>تسليم وخروج من المعمل</DialogTitle><DialogDescription>يوثق الجهة التي خرج إليها المنتج ووقت التسليم، ولا يخصم أي فيلمنت إضافي.</DialogDescription></DialogHeader><form onSubmit={submitDelivery} className="space-y-4"><div><Label>تم التسليم إلى</Label><Input className="mt-2" value={deliveryTarget} onChange={event => setDeliveryTarget(event.target.value)} placeholder="اسم المستلم أو القسم" required /></div><Button type="submit" className="w-full" disabled={deliverOrder.isPending}>تأكيد التسليم والخروج</Button></form></DialogContent></Dialog>
  </div>;
}
