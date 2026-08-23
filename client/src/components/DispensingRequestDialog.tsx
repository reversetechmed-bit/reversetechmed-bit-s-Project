import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, HandHeart, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type RequestablePart = {
  id: number;
  name: string;
  partNumber: string;
  quantity: number;
  reservedQuantity: number;
  custodyQuantity: number;
  warehouseSection: "components" | "products";
};

type FulfillmentType = "dispense" | "custody";

export default function DispensingRequestDialog({ part, open, onOpenChange }: { part: RequestablePart | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("dispense");
  const [dueDate, setDueDate] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [requestNote, setRequestNote] = useState("");

  useEffect(() => {
    if (open) {
      setQuantity(1); setPurpose(""); setFulfillmentType("dispense"); setDueDate(""); setProjectReference(""); setRequestNote("");
    }
  }, [open, part?.id]);

  const createRequest = trpc.warehouse.requests.create.useMutation({
    onSuccess: async result => {
      toast.success(result.notificationSent ? (result.fulfillmentType === "custody" ? "تم تسجيل طلب العُهدة وإشعار مسؤول المخزن." : "تم تسجيل الطلب وإشعار مسؤول المخزن.") : "تم تسجيل الطلب.");
      onOpenChange(false);
      await Promise.all([utils.warehouse.requests.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.alerts.list.invalidate(), utils.warehouse.custody.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!part || !purpose.trim()) return;
    const available = Math.max(0, part.quantity - part.reservedQuantity - part.custodyQuantity);
    createRequest.mutate({
      partId: part.id,
      requestedQuantity: Math.min(Math.max(1, quantity), available),
      purpose: purpose.trim(),
      fulfillmentType,
      dueDate: fulfillmentType === "custody" && dueDate ? dueDate : undefined,
      projectReference: projectReference.trim() || undefined,
      requestNote: requestNote.trim() || undefined,
    });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0"><DialogHeader className="border-b border-[#d9d0bf] bg-[#fcf8ef] px-6 pb-5 pt-6"><p className="eyebrow">طلب موثّق</p><DialogTitle className="text-xl text-[#18354a]">طلب {part?.warehouseSection === "products" ? "منتج" : "مكون"} من المخزن</DialogTitle><DialogDescription>اسم الموظف يُؤخذ تلقائيًا من الحساب الحالي؛ اختر فقط هل القطعة صرف دائم أم عُهدة ستعود إلى المخزن.</DialogDescription></DialogHeader>{part && (() => { const available = Math.max(0, part.quantity - part.reservedQuantity - part.custodyQuantity); return <form onSubmit={submit} className="space-y-5 p-6"><div className="rounded-xl border border-[#d9d0bf] bg-white p-4"><p className="font-semibold text-[#18354a]">{part.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{part.partNumber}</p><div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4"><div className="rounded-lg bg-[#f4f0e8] p-2"><p className="text-slate-500">فعلي</p><p className="mt-1 font-bold text-[#18354a]">{part.quantity}</p></div><div className="rounded-lg bg-violet-50 p-2"><p className="text-violet-500">محجوز</p><p className="mt-1 font-bold text-violet-800">{part.reservedQuantity}</p></div><div className="rounded-lg bg-amber-50 p-2"><p className="text-amber-600">عُهدة</p><p className="mt-1 font-bold text-amber-800">{part.custodyQuantity}</p></div><div className="rounded-lg bg-emerald-50 p-2"><p className="text-emerald-600">متاح داخل المخزن</p><p className="mt-1 font-bold text-emerald-800">{available}</p></div></div></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setFulfillmentType("dispense")} className={`rounded-xl border p-4 text-right transition ${fulfillmentType === "dispense" ? "border-[#0178D4] bg-[#F1F8FE] ring-1 ring-[#0178D4]/30" : "border-[#d9d0bf] bg-white hover:bg-[#fcf8ef]"}`}><span className="flex items-center gap-2 font-bold text-[#18354a]"><ClipboardCheck className="h-4 w-4 text-[#0178D4]" />صرف دائم</span><span className="mt-1 block text-xs leading-5 text-slate-500">يُحجز عند الاعتماد، ثم يُخصم فعليًا عند التسليم مع فاتورة.</span></button><button type="button" onClick={() => setFulfillmentType("custody")} className={`rounded-xl border p-4 text-right transition ${fulfillmentType === "custody" ? "border-[#b5792e] bg-[#fff8ea] ring-1 ring-[#b5792e]/30" : "border-[#d9d0bf] bg-white hover:bg-[#fcf8ef]"}`}><span className="flex items-center gap-2 font-bold text-[#18354a]"><HandHeart className="h-4 w-4 text-[#b5792e]" />عُهدة</span><span className="mt-1 block text-xs leading-5 text-slate-500">تُسجل باسمك، لا تخصم الرصيد الفعلي، وتُغلق عند إعادتها للمخزن.</span></button></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="request-quantity">الكمية المطلوبة</Label><Input id="request-quantity" type="number" min="1" max={available} value={quantity} onChange={event => setQuantity(Math.min(available, Math.max(1, Number(event.target.value) || 1)))} disabled={available === 0} /></div>{fulfillmentType === "custody" && <div className="space-y-2"><Label htmlFor="custody-due-date">موعد الإعادة المتوقع <span className="text-slate-400">(اختياري)</span></Label><Input id="custody-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>}<div className="space-y-2 sm:col-span-2"><Label htmlFor="request-reference">مرجع المشروع أو الجهاز <span className="text-slate-400">(اختياري)</span></Label><Input id="request-reference" value={projectReference} onChange={event => setProjectReference(event.target.value)} placeholder="مثال: جهاز / كود مشروع" /></div></div><div className="space-y-2"><Label htmlFor="request-purpose">سبب الطلب</Label><Textarea id="request-purpose" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder={fulfillmentType === "custody" ? "اشرح العمل الذي ستستخدم فيه العُهدة." : "اشرح المشروع أو الاختبار أو مهمة الصيانة التي تحتاج هذا العنصر."} rows={3} required /></div><div className="space-y-2"><Label htmlFor="request-note">ملاحظة إضافية <span className="text-slate-400">(اختيارية)</span></Label><Textarea id="request-note" value={requestNote} onChange={event => setRequestNote(event.target.value)} placeholder="تعليمات أو حالة خاصة لمسؤول المخزن." rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={createRequest.isPending || available === 0} className="gap-2 bg-[#a97937] text-white hover:bg-[#8c622a]"><Send className="h-4 w-4" />{available === 0 ? "غير متاح داخل المخزن" : createRequest.isPending ? "يجري الإرسال…" : `إرسال طلب ${fulfillmentType === "custody" ? "العُهدة" : "الصرف"}`}</Button></DialogFooter></form>; })()}</DialogContent></Dialog>;
}
