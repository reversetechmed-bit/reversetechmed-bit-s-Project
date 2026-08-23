import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDate } from "@/lib/warehouse";
import { trpc } from "@/lib/trpc";
import { HandHeart, RotateCcw, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Custody() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.warehouse.custody.list.useQuery();
  const [search, setSearch] = useState("");
  const [returnTarget, setReturnTarget] = useState<{ id: number; partName: string; custodyNumber: string } | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const confirmReturn = trpc.warehouse.custody.confirmReturn.useMutation({
    onSuccess: async result => {
      toast.success(`تمت إعادة العُهدة ${result.custodyNumber} إلى سجل المخزن.`);
      setReturnTarget(null); setReturnNote("");
      await Promise.all([utils.warehouse.custody.list.invalidate(), utils.warehouse.inventory.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.transactions.invalidate(), utils.warehouse.requests.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const filtered = useMemo(() => (rows ?? []).filter(({ custody, part, holder }) => `${custody.custodyNumber} ${part.name} ${part.partNumber} ${holder.name ?? ""} ${holder.email ?? ""} ${custody.status}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  return <div className="space-y-6"><section><p className="eyebrow">متابعة العُهد</p><h1 className="page-title">{isAdmin ? "عُهد الموظفين" : "عُهدتي"}</h1><p className="page-subtitle">العُهدة لا تخصم الرصيد الفعلي، لكنها توضح ما هو خارج المخزن ومن هو المسؤول عنه حتى تُسجّل عودتها.</p></section><section className="panel overflow-hidden"><div className="border-b border-[#d9d0bf] bg-[#fcf8ef] p-5"><div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94713d]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث برقم العُهدة أو الموظف أو القطعة…" className="bg-white pr-9" /></div></div><div className="divide-y divide-[#ece6d9]">{isLoading && <div className="p-8 text-center text-sm text-slate-500">يجري تحميل العُهد…</div>}{!isLoading && filtered.map(({ custody, part, holder }) => { const active = custody.status === "active"; return <article key={custody.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 gap-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><HandHeart className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[#18354a]">{part.name}</h2><span className="font-mono text-xs text-slate-500">{part.partNumber}</span><Badge variant="outline" className={active ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>{active ? "عُهدة قائمة" : "أُعيدت"}</Badge></div><p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-[#18354a]">{custody.quantity} وحدة</span> بعهدة <span className="font-semibold text-[#18354a]">{holder.name || holder.email || "موظف"}</span></p><p className="mt-1 font-mono text-xs text-slate-500">{custody.custodyNumber}</p><p className="mt-2 text-sm text-slate-600"><span className="text-slate-400">الغرض:</span> {custody.purpose}</p>{custody.dueAt && <p className="mt-1 text-xs text-amber-700">موعد الإعادة المتوقع: {formatDate(custody.dueAt)}</p>}{custody.issueNote && <p className="mt-1 text-xs text-slate-500">ملاحظة الإصدار: {custody.issueNote}</p>}{custody.returnNote && <p className="mt-1 text-xs text-emerald-700">ملاحظة الإعادة: {custody.returnNote}</p>}<p className="mt-3 text-xs text-slate-400">سُجلت في {formatDate(custody.issuedAt)}{custody.returnedAt ? ` · أُعيدت في ${formatDate(custody.returnedAt)}` : ""}</p></div></div>{isAdmin && active && <Button size="sm" onClick={() => { setReturnTarget({ id: custody.id, partName: part.name, custodyNumber: custody.custodyNumber }); setReturnNote(""); }} className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"><RotateCcw className="h-3.5 w-3.5" />تأكيد الإعادة</Button>}</div></article>; })}{!isLoading && !filtered.length && <div className="p-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100"><UserRound className="h-5 w-5 text-slate-400" /></div><h2 className="mt-4 font-semibold text-slate-900">لا توجد عُهد مطابقة</h2><p className="mt-1 text-sm text-slate-500">ستظهر هنا العُهد التي تم اعتمادها وتسليمها.</p></div>}</div></section><Dialog open={Boolean(returnTarget)} onOpenChange={open => !open && setReturnTarget(null)}><DialogContent className="max-w-lg"><DialogHeader><p className="eyebrow">إعادة العُهدة</p><DialogTitle>تأكيد إعادة {returnTarget?.partName}؟</DialogTitle><DialogDescription>لن يغيّر ذلك الرصيد الفعلي لأنه لم يُخصم عند إصدار العُهدة، لكنه سيزيلها من إجمالي العُهد القائمة.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="custody-return-note">ملاحظة الإعادة <span className="text-slate-400">(اختيارية)</span></Label><Textarea id="custody-return-note" value={returnNote} onChange={event => setReturnNote(event.target.value)} placeholder="مثال: تمت الإعادة بحالة سليمة." rows={3} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setReturnTarget(null)}>إلغاء</Button><Button type="button" disabled={confirmReturn.isPending} onClick={() => returnTarget && confirmReturn.mutate({ id: returnTarget.id, returnNote: returnNote.trim() || undefined })} className="bg-emerald-700 text-white hover:bg-emerald-800">{confirmReturn.isPending ? "يجري التسجيل…" : "تأكيد الإعادة"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
