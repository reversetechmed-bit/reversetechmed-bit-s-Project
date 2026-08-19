import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type RequestablePart = {
  id: number;
  name: string;
  partNumber: string;
  quantity: number;
  reservedQuantity: number;
  warehouseSection: "components" | "products";
};

export default function DispensingRequestDialog({ part, open, onOpenChange }: { part: RequestablePart | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState("");
  useEffect(() => { if (open) { setQuantity(1); setPurpose(""); } }, [open, part?.id]);
  const createRequest = trpc.warehouse.requests.create.useMutation({
    onSuccess: async result => {
      toast.success(result.notificationSent ? "تم تسجيل الطلب وإشعار مسؤول المخزن." : "تم تسجيل طلب الصرف.");
      onOpenChange(false);
      await Promise.all([utils.warehouse.requests.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.alerts.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!part || !purpose.trim()) return;
    createRequest.mutate({ partId: part.id, requestedQuantity: Math.min(Math.max(1, quantity), Math.max(0, part.quantity - part.reservedQuantity)), purpose: purpose.trim() });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl overflow-hidden p-0"><DialogHeader className="border-b border-[#E8EEF3] bg-[#F7FBFF] px-6 pb-5 pt-6"><p className="eyebrow">طلب صرف</p><DialogTitle className="text-xl text-[#0B2E4E]">طلب {part?.warehouseSection === "products" ? "منتج" : "مكون"} من المخزن</DialogTitle><DialogDescription>سيصل الطلب إلى مسؤول المخزن للمراجعة قبل تسليم القطعة فعليًا.</DialogDescription></DialogHeader>{part && (() => { const available = Math.max(0, part.quantity - part.reservedQuantity); return <form onSubmit={submit} className="space-y-5 p-6"><div className="rounded-xl border border-[#DCEAF7] bg-white p-4"><p className="font-semibold text-[#0B2E4E]">{part.name}</p><p className="mt-1 text-xs text-slate-500 font-mono">{part.partNumber}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-400">فعلي</p><p className="mt-1 font-bold text-[#0B2E4E]">{part.quantity}</p></div><div className="rounded-lg bg-violet-50 p-2"><p className="text-violet-500">محجوز</p><p className="mt-1 font-bold text-violet-800">{part.reservedQuantity}</p></div><div className="rounded-lg bg-emerald-50 p-2"><p className="text-emerald-600">متاح</p><p className="mt-1 font-bold text-emerald-800">{available}</p></div></div></div><div className="space-y-2"><Label htmlFor="request-quantity">الكمية المطلوبة</Label><Input id="request-quantity" type="number" min="1" max={available} value={quantity} onChange={event => setQuantity(Math.min(available, Math.max(1, Number(event.target.value) || 1)))} disabled={available === 0} /></div><div className="space-y-2"><Label htmlFor="request-purpose">سبب الطلب</Label><Textarea id="request-purpose" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="اشرح المشروع أو الاختبار أو مهمة الصيانة التي تحتاج هذا العنصر." rows={4} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={createRequest.isPending || available === 0} className="gap-2 bg-[#0178D4] text-white hover:bg-[#0065B3]"><Send className="h-4 w-4" />{available === 0 ? "غير متاح حاليًا" : createRequest.isPending ? "يجري الإرسال…" : "إرسال الطلب"}</Button></DialogFooter></form>; })()}</DialogContent></Dialog>;
}
