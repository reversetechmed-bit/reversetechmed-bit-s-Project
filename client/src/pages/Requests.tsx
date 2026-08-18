import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { categoryMeta, formatDate, initials, requestStatusMeta } from "@/lib/warehouse";
import { trpc } from "@/lib/trpc";
import { Check, ClipboardPlus, PackageCheck, Send, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.warehouse.requests.list.useQuery();
  const { data: parts } = trpc.warehouse.inventory.list.useQuery();
  const [requestOpen, setRequestOpen] = useState(false);
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [rejectionTarget, setRejectionTarget] = useState<{ id: number; partName: string } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    await Promise.all([utils.warehouse.requests.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.inventory.list.invalidate(), utils.warehouse.transactions.invalidate(), utils.warehouse.alerts.list.invalidate()]);
  };
  const createRequest = trpc.warehouse.requests.create.useMutation({
    onSuccess: async result => { toast.success(result.notificationSent ? "Request submitted and the warehouse manager was notified." : "Request submitted successfully."); setRequestOpen(false); setPartId(""); setQuantity(1); setPurpose(""); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const decide = trpc.warehouse.requests.decide.useMutation({ onSuccess: async result => { toast.success(`Request ${result.status}.`); setRejectionTarget(null); setRejectionNote(""); await refresh(); }, onError: error => toast.error(error.message) });
  const deliver = trpc.warehouse.requests.confirmDelivery.useMutation({ onSuccess: async result => { toast.success(`Delivery confirmed. Invoice ${result.invoiceNumber} created; ${result.quantityAfter} units remain in stock.`); await refresh(); }, onError: error => toast.error(error.message) });

  const requestableParts = useMemo(() => (parts ?? []).filter(part => part.quantity > 0), [parts]);
  const filteredRequests = useMemo(() => (requests ?? []).filter(({ request, part, engineer }) => `${part.name} ${part.partNumber} ${request.purpose} ${request.status} ${engineer.name ?? ""} ${engineer.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [requests, search]);
  const selectedPart = requestableParts.find(part => String(part.id) === partId);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!partId || !purpose.trim()) return;
    createRequest.mutate({ partId: Number(partId), requestedQuantity: quantity, purpose: purpose.trim() });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Controlled dispensing</p><h1 className="page-title">{isAdmin ? "Incoming requests" : "My dispensing requests"}</h1><p className="page-subtitle">{isAdmin ? "Review demand, approve eligible requests, and confirm the physical handover." : "Request the parts you need and follow each request through the warehouse workflow."}</p></div>
        {!isAdmin && <Button onClick={() => setRequestOpen(true)} className="bg-slate-950 hover:bg-slate-800 text-white gap-2"><ClipboardPlus className="h-4 w-4" />New request</Button>}
      </section>
      <section className="panel overflow-hidden">
        <div className="p-4 border-b border-[#E8EEF3] bg-[#F7FBFF]"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={isAdmin ? "Search by person, item, code, status, or purpose…" : "Search your requests by item, code, status, or purpose…"} className="bg-white" /></div>
        <div className="divide-y divide-slate-100">
          {isLoading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="p-6 animate-pulse"><div className="h-5 bg-slate-100 rounded w-1/3" /><div className="h-4 bg-slate-100 rounded w-2/3 mt-3" /></div>)}
          {!isLoading && filteredRequests.map(({ request, part, engineer }) => {
            const status = requestStatusMeta[request.status];
            const category = categoryMeta[part.category];
            return <article key={request.id} className="p-5 sm:p-6 hover:bg-slate-50/60 transition-colors">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4 min-w-0"><div className="w-10 h-10 rounded-xl bg-[#0B2E4E] text-white grid place-items-center font-semibold shrink-0">{initials(engineer.name)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[#0B2E4E]">{part.name}</h2><span className="font-mono text-xs text-slate-500">{part.partNumber}</span><Badge variant="outline" className={part.warehouseSection === "products" ? "bg-[#FFF3EB] border-[#FFD3B7] text-[#C74D00]" : "bg-[#E7F8F4] border-[#BEECDD] text-[#008E7A]"}>{part.warehouseSection === "products" ? "Products" : "Components"}</Badge><Badge variant="outline" className={`${category.soft} ${category.accent}`}>{category.label} · {category.arabic}</Badge></div><p className="text-sm text-slate-600 mt-2"><span className="font-medium text-slate-800">{request.requestedQuantity} unit{request.requestedQuantity !== 1 ? "s" : ""}</span> requested by <span className="font-medium text-slate-800">{engineer.name || engineer.email || "Engineer"}</span></p><p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-2xl"><span className="text-slate-400">Purpose:</span> {request.purpose}</p><p className="text-xs text-slate-400 mt-3">Submitted {formatDate(request.createdAt)}</p></div></div>
                <div className="flex flex-wrap gap-2 items-center lg:justify-end"><Badge variant="outline" className={`${status.className} font-medium px-2.5 py-1`}>{status.label}</Badge>{isAdmin && request.status === "pending" && <><Button size="sm" onClick={() => decide.mutate({ id: request.id, decision: "approved" })} disabled={decide.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => { setRejectionTarget({ id: request.id, partName: part.name }); setRejectionNote(""); }} disabled={decide.isPending} className="text-rose-700 border-rose-200 hover:bg-rose-50 gap-1.5"><X className="h-3.5 w-3.5" />Reject</Button></>}{isAdmin && request.status === "approved" && <Button size="sm" onClick={() => deliver.mutate({ id: request.id })} disabled={deliver.isPending} className="bg-slate-950 hover:bg-slate-800 text-white gap-1.5"><PackageCheck className="h-3.5 w-3.5" />Confirm handover</Button>}</div>
              </div>
              {request.reviewedAt && <div className="ml-0 sm:ml-14 mt-3 text-xs text-slate-500">Review recorded {formatDate(request.reviewedAt)}{request.decisionNote ? <span className="block mt-1 text-slate-600"><span className="text-slate-400">Decision note:</span> {request.decisionNote}</span> : null}</div>}
              {request.status === "approved" && isAdmin && <div className="ml-0 sm:ml-14 mt-4 rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-800">Approval recorded. Confirm handover only after the part is physically delivered; this will deduct stock automatically.</div>}
            </article>;
          })}
        </div>
        {!isLoading && !filteredRequests.length && <div className="py-16 text-center"><div className="mx-auto h-11 w-11 rounded-xl bg-slate-100 grid place-items-center"><UserRound className="h-5 w-5 text-slate-500" /></div><h2 className="mt-4 font-semibold text-slate-900">{search ? "No matching requests" : "No requests yet"}</h2><p className="mt-1 text-sm text-slate-500">{search ? "Try another search term." : isAdmin ? "Incoming engineering requests will appear here." : "Create a request when you need a warehouse part."}</p>{!search && !isAdmin && <Button variant="outline" onClick={() => setRequestOpen(true)} className="mt-5">Create request</Button>}</div>}
      </section>
      <Dialog open={Boolean(rejectionTarget)} onOpenChange={open => !open && setRejectionTarget(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><p className="eyebrow">Request decision</p><DialogTitle>Reject {rejectionTarget?.partName}?</DialogTitle><DialogDescription>Add an optional note so the engineer understands why the request could not be approved.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="rejection-note">Rejection note <span className="text-slate-400">(optional)</span></Label><Textarea id="rejection-note" value={rejectionNote} onChange={event => setRejectionNote(event.target.value)} placeholder="e.g. quantity is reserved for a critical repair" rows={4} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRejectionTarget(null)}>Cancel</Button><Button type="button" disabled={decide.isPending} onClick={() => rejectionTarget && decide.mutate({ id: rejectionTarget.id, decision: "rejected", decisionNote: rejectionNote.trim() || undefined })} className="bg-rose-600 hover:bg-rose-700 text-white">{decide.isPending ? "Rejecting…" : "Confirm rejection"}</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden gap-0"><DialogHeader className="px-6 pt-6 pb-5 border-b border-[#E8EEF3] bg-[#F7FBFF]"><p className="eyebrow">Engineering request</p><DialogTitle className="text-xl text-[#0B2E4E]">Request a warehouse record</DialogTitle><DialogDescription>Your request is sent to the warehouse manager for review before any stock is released.</DialogDescription></DialogHeader><form onSubmit={submit} className="p-6 space-y-5"><div className="space-y-2"><Label>Available component or product</Label><Select value={partId} onValueChange={setPartId}><SelectTrigger><SelectValue placeholder="Choose a record" /></SelectTrigger><SelectContent>{requestableParts.map(part => <SelectItem key={part.id} value={String(part.id)}>[{part.warehouseSection === "products" ? "Products" : "Components"}] {part.name} · {part.partNumber} ({part.quantity} available)</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="request-quantity">Quantity needed</Label><Input id="request-quantity" type="number" min="1" max={selectedPart?.quantity || 1} value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value)))} /></div>{selectedPart && <div className="rounded-lg bg-[#F7FBFF] border border-[#E8EEF3] p-3"><p className="text-[11px] uppercase tracking-wider text-slate-500">Available stock</p><p className="font-semibold text-[#0B2E4E] mt-1">{selectedPart.quantity} units</p></div>}</div><div className="space-y-2"><Label htmlFor="request-purpose">Purpose of request</Label><Textarea id="request-purpose" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="Explain the project, test, prototype, or maintenance task requiring this item." rows={4} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button type="submit" disabled={createRequest.isPending || !partId} className="bg-[#0178D4] hover:bg-[#0065B3] text-white gap-2"><Send className="h-4 w-4" />{createRequest.isPending ? "Sending…" : "Submit request"}</Button></DialogFooter></form></DialogContent>
      </Dialog>
    </div>
  );
}
