import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { categoryMeta, formatDate, initials, requestStatusMeta } from "@/lib/warehouse";
import { trpc } from "@/lib/trpc";
import { Check, HandHeart, PackageCheck, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type DeliveryTarget = { id: number; partName: string; recipient: string; fulfillmentType: "dispense" | "custody" };

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.warehouse.requests.list.useQuery();
  const [search, setSearch] = useState("");
  const [rejectionTarget, setRejectionTarget] = useState<{ id: number; partName: string } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState<DeliveryTarget | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");

  useEffect(() => { if (user && !isAdmin) setLocation("/my-requests"); }, [user, isAdmin, setLocation]);
  const refresh = async () => { await Promise.all([utils.warehouse.requests.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.inventory.list.invalidate(), utils.warehouse.transactions.invalidate(), utils.warehouse.alerts.list.invalidate(), utils.warehouse.invoices.list.invalidate(), utils.warehouse.custody.list.invalidate()]); };
  const decide = trpc.warehouse.requests.decide.useMutation({
    onSuccess: async result => { toast.success(result.status === "approved" ? "تم اعتماد الطلب." : "تم رفض الطلب."); setRejectionTarget(null); setRejectionNote(""); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const deliver = trpc.warehouse.requests.confirmDelivery.useMutation({
    onSuccess: async result => { toast.success(result.fulfillmentType === "custody" ? `تم تسجيل العُهدة ${result.custodyNumber} دون خصم الرصيد الفعلي.` : `تم تأكيد التسليم وإنشاء الفاتورة ${result.invoiceNumber}. المتبقي: ${result.quantityAfter} وحدة.`); setDeliveryTarget(null); setDeliveryNote(""); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const filtered = useMemo(() => (requests ?? []).filter(({ request, part, engineer }) => `${part.name} ${part.partNumber} ${request.purpose} ${request.fulfillmentType} ${request.status} ${engineer.name ?? ""} ${engineer.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [requests, search]);

  if (user && !isAdmin) return <div className="panel p-8 text-center text-sm text-slate-500">يجري تحويلك إلى صفحة طلباتي…</div>;

  return <div className="space-y-6">
    <section>
      <p className="eyebrow">طلبات المخزن</p>
      <h1 className="page-title">الطلبات الواردة</h1>
      <p className="page-subtitle">راجع طلبات الصرف والعُهدة، ثم اعتمدها وسجل التسليم أو الحائز دون خلط بين الرصيد الفعلي والعهدة.</p>
    </section>
    <section className="panel overflow-hidden">
      <div className="border-b border-[#d9d0bf] bg-[#fcf8ef] p-4">
        <div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94713d]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باليوزر أو القطعة أو الكود أو الحالة…" className="bg-white pr-9" /></div>
      </div>
      <div className="divide-y divide-[#ece6d9]">
        {isLoading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="animate-pulse p-6"><div className="h-5 w-1/3 rounded bg-slate-100" /><div className="mt-3 h-4 w-2/3 rounded bg-slate-100" /></div>)}
        {!isLoading && filtered.map(({ request, part, engineer }) => {
          const status = requestStatusMeta[request.status];
          const category = categoryMeta[part.category];
          const isCustody = request.fulfillmentType === "custody";
          return <article key={request.id} className="p-5 transition-colors hover:bg-[#fcf8ef] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#17374c] font-semibold text-white">{initials(engineer.name)}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[#18354a]">{part.name}</h2><span className="font-mono text-xs text-slate-500">{part.partNumber}</span>
                    <Badge variant="outline" className={part.warehouseSection === "products" ? "border-[#e4cca1] bg-[#fff7e8] text-[#8a642c]" : "border-[#BEECDD] bg-[#E7F8F4] text-[#008E7A]"}>{part.warehouseSection === "products" ? "منتج" : "مكون"}</Badge>
                    <Badge variant="outline" className={`${category.soft} ${category.accent}`}>{category.arabic}</Badge>
                    <Badge variant="outline" className={isCustody ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}>{isCustody ? "عُهدة" : "صرف"}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">{request.requestedQuantity} وحدة</span> طلبها <span className="font-medium text-slate-800">{engineer.name || engineer.email || "مهندس"}</span></p>
                  {isCustody && <p className="mt-1 text-xs text-amber-700">تُسجل العُهدة باسم الموظف ولا تخصم الرصيد الفعلي عند الإصدار.</p>}
                  {request.projectReference && <p className="mt-1 text-sm text-slate-600">المرجع: <span className="font-semibold text-[#18354a]">{request.projectReference}</span></p>}
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500"><span className="text-slate-400">الغرض:</span> {request.purpose}</p>
                  <p className="mt-3 text-xs text-slate-400">قُدّم في {formatDate(request.createdAt)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant="outline" className={`${status.className} px-2.5 py-1 font-medium`}>{status.label}</Badge>
                {request.status === "pending" && <><Button size="sm" onClick={() => decide.mutate({ id: request.id, decision: "approved" })} disabled={decide.isPending} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" />اعتماد</Button><Button size="sm" variant="outline" onClick={() => { setRejectionTarget({ id: request.id, partName: part.name }); setRejectionNote(""); }} disabled={decide.isPending} className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"><X className="h-3.5 w-3.5" />رفض</Button></>}
                {request.status === "approved" && <Button size="sm" onClick={() => { setDeliveryTarget({ id: request.id, partName: part.name, recipient: engineer.name || engineer.email || "الموظف", fulfillmentType: request.fulfillmentType }); setDeliveryNote(""); }} disabled={deliver.isPending} className="gap-1.5 bg-[#17374c] text-white hover:bg-[#102938]">{isCustody ? <HandHeart className="h-3.5 w-3.5" /> : <PackageCheck className="h-3.5 w-3.5" />}{isCustody ? "تسجيل العُهدة" : "تأكيد التسليم"}</Button>}
              </div>
            </div>
            {request.reviewedAt && <div className="mt-3 text-xs text-slate-500 sm:mr-14">سُجلت المراجعة في {formatDate(request.reviewedAt)}{request.decisionNote && <span className="mt-1 block text-slate-600"><span className="text-slate-400">ملاحظة القرار:</span> {request.decisionNote}</span>}</div>}
            {request.status === "approved" && <div className="mt-4 rounded-lg border border-[#d9d0bf] bg-[#fcf8ef] px-3 py-2 text-xs text-[#6e5632] sm:mr-14">{isCustody ? "اعتمدت العُهدة. سجل الحائز عند التسليم؛ لا يُخصم الرصيد الفعلي." : "اعتمد الطلب وحُجزت كميته. سجّل ملاحظة التسليم عند تسليم القطعة فعليًا لإنشاء فاتورة مستقلة."}</div>}
          </article>;
        })}
        {!isLoading && !filtered.length && <div className="py-16 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100"><UserRound className="h-5 w-5 text-slate-500" /></div><h2 className="mt-4 font-semibold text-slate-900">{search ? "لا توجد طلبات مطابقة" : "لا توجد طلبات بعد"}</h2><p className="mt-1 text-sm text-slate-500">{search ? "جرّب كلمة بحث أخرى." : "ستظهر طلبات المهندسين الواردة هنا."}</p></div>}
      </div>
    </section>
    <Dialog open={Boolean(rejectionTarget)} onOpenChange={open => !open && setRejectionTarget(null)}><DialogContent className="max-w-lg"><DialogHeader><p className="eyebrow">قرار الطلب</p><DialogTitle>رفض طلب {rejectionTarget?.partName}؟</DialogTitle><DialogDescription>أضف ملاحظة اختيارية ليفهم المهندس سبب عدم اعتماد الطلب.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="rejection-note">ملاحظة الرفض <span className="text-slate-400">(اختيارية)</span></Label><Textarea id="rejection-note" value={rejectionNote} onChange={event => setRejectionNote(event.target.value)} placeholder="مثال: الكمية محجوزة لإصلاح عاجل" rows={4} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRejectionTarget(null)}>إلغاء</Button><Button type="button" disabled={decide.isPending} onClick={() => rejectionTarget && decide.mutate({ id: rejectionTarget.id, decision: "rejected", decisionNote: rejectionNote.trim() || undefined })} className="bg-rose-600 text-white hover:bg-rose-700">{decide.isPending ? "يجري الرفض…" : "تأكيد الرفض"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deliveryTarget)} onOpenChange={open => !open && setDeliveryTarget(null)}><DialogContent className="max-w-lg"><DialogHeader><p className="eyebrow">{deliveryTarget?.fulfillmentType === "custody" ? "تسجيل عُهدة" : "تأكيد التسليم"}</p><DialogTitle>{deliveryTarget?.fulfillmentType === "custody" ? `تسجيل ${deliveryTarget?.partName} بعهدة ${deliveryTarget?.recipient}؟` : `تسليم ${deliveryTarget?.partName} إلى ${deliveryTarget?.recipient}؟`}</DialogTitle><DialogDescription>{deliveryTarget?.fulfillmentType === "custody" ? "لن يُخصم الرصيد الفعلي؛ ستُضاف القطعة إلى سجل عُهد الموظف حتى تأكيد إعادتها." : "سيُخصم الرصيد المحجوز وتُنشأ فاتورة مستقلة بالتاريخ والوقت الحاليين."}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="delivery-note">ملاحظة {deliveryTarget?.fulfillmentType === "custody" ? "الإصدار" : "التسليم"} <span className="text-slate-400">(اختيارية)</span></Label><Textarea id="delivery-note" value={deliveryNote} onChange={event => setDeliveryNote(event.target.value)} placeholder="مثال: تم التسليم بحالة سليمة." rows={4} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDeliveryTarget(null)}>إلغاء</Button><Button type="button" disabled={deliver.isPending} onClick={() => deliveryTarget && deliver.mutate({ id: deliveryTarget.id, deliveryNote: deliveryNote.trim() || undefined })} className="bg-[#17374c] text-white hover:bg-[#102938]">{deliver.isPending ? "يجري التسجيل…" : deliveryTarget?.fulfillmentType === "custody" ? "تأكيد تسجيل العُهدة" : "تأكيد وإنشاء الفاتورة"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
