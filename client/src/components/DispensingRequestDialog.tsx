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
  warehouseSection: "components" | "products";
};

export default function DispensingRequestDialog({ part, open, onOpenChange }: { part: RequestablePart | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState("");
  useEffect(() => { if (open) { setQuantity(1); setPurpose(""); } }, [open, part?.id]);
  const createRequest = trpc.warehouse.requests.create.useMutation({
    onSuccess: async result => {
      toast.success(result.notificationSent ? "تم إرسال الطلب وإشعار مسؤول المخزن." : "تم إرسال طلب الصرف بنجاح.");
      onOpenChange(false);
      await Promise.all([utils.warehouse.requests.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.alerts.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!part || !purpose.trim()) return;
    createRequest.mutate({ partId: part.id, requestedQuantity: Math.min(Math.max(1, quantity), part.quantity), purpose: purpose.trim() });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl overflow-hidden p-0"><DialogHeader className="border-b border-[#E8EEF3] bg-[#F7FBFF] px-6 pb-5 pt-6"><p className="eyebrow">طلب صرف</p><DialogTitle className="text-xl text-[#0B2E4E]">طلب {part?.warehouseSection === "products" ? "منتج" : "مكون"} من المخزن</DialogTitle><DialogDescription>سيصل الطلب إلى مسؤول المخزن للمراجعة قبل تسليم القطعة فعليًا.</DialogDescription></DialogHeader>{part && <form onSubmit={submit} className="space-y-5 p-6"><div className="rounded-xl border border-[#DCEAF7] bg-white p-4"><p className="font-semibold text-[#0B2E4E]">{part.name}</p><p className="mt-1 text-xs text-slate-500 font-mono">{part.partNumber}</p><p className="mt-3 text-sm text-slate-600">المتاح حاليًا: <span className="font-bold text-[#0B2E4E]">{part.quantity} وحدة</span></p></div><div className="space-y-2"><Label htmlFor="request-quantity">الكمية المطلوبة</Label><Input id="request-quantity" type="number" min="1" max={part.quantity} value={quantity} onChange={event => setQuantity(Math.min(part.quantity, Math.max(1, Number(event.target.value) || 1)))} /></div><div className="space-y-2"><Label htmlFor="request-purpose">سبب الطلب</Label><Textarea id="request-purpose" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="اشرح المشروع أو الاختبار أو مهمة الصيانة التي تحتاج هذا العنصر." rows={4} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={createRequest.isPending} className="gap-2 bg-[#0178D4] text-white hover:bg-[#0065B3]"><Send className="h-4 w-4" />{createRequest.isPending ? "يجري الإرسال…" : "إرسال الطلب"}</Button></DialogFooter></form>}</DialogContent></Dialog>;
}
