import PartFormDialog, { type EditablePart } from "@/components/PartFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { categoryMeta } from "@/lib/warehouse";
import { trpc } from "@/lib/trpc";
import { Boxes, MapPin, PackagePlus, Pencil, Search, TriangleAlert, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: parts, isLoading } = trpc.warehouse.inventory.list.useQuery();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<EditablePart | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditablePart | null>(null);

  const refresh = async () => {
    await Promise.all([utils.warehouse.inventory.list.invalidate(), utils.warehouse.dashboard.invalidate(), utils.warehouse.alerts.list.invalidate()]);
  };
  const createPart = trpc.warehouse.inventory.create.useMutation({
    onSuccess: async () => { toast.success("Part added to the warehouse."); setDialogOpen(false); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const updatePart = trpc.warehouse.inventory.update.useMutation({
    onSuccess: async () => { toast.success("Part record updated."); setDialogOpen(false); setEditingPart(null); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const removePart = trpc.warehouse.inventory.remove.useMutation({
    onSuccess: async () => { toast.success("Part removed from active inventory."); setDeleteTarget(null); await refresh(); },
    onError: error => toast.error(error.message),
  });

  const filteredParts = useMemo(() => (parts ?? []).filter(part => {
    const text = `${part.partNumber} ${part.name} ${part.location ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (category === "All" || part.category === category);
  }), [parts, search, category]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Stock directory</p>
          <h1 className="page-title">Warehouse inventory</h1>
          <p className="page-subtitle">Trace every electronic, medical, embedded, and board-level part from one controlled catalogue.</p>
        </div>
        {isAdmin && <Button onClick={() => { setEditingPart(null); setDialogOpen(true); }} className="bg-slate-950 hover:bg-slate-800 text-white gap-2"><PackagePlus className="h-4 w-4" />Add part</Button>}
      </section>

      <section className="panel p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9 bg-white border-slate-200" placeholder="Search by part number, name, or location…" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {["All", "Medical", "Embedded", "Electronics", "Boards"].map(value => (
            <button key={value} onClick={() => setCategory(value)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${category === value ? "bg-slate-950 text-white border-slate-950" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {value === "All" ? "All categories" : `${categoryMeta[value].label} · ${categoryMeta[value].arabic}`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[850px]">
            <thead className="bg-slate-50/90 border-b border-slate-100">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-6 py-4 font-semibold">Part</th><th className="px-4 py-4 font-semibold">Category</th><th className="px-4 py-4 font-semibold">Location</th><th className="px-4 py-4 font-semibold">Available</th><th className="px-4 py-4 font-semibold">Threshold</th>{isAdmin && <th className="px-6 py-4 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && Array.from({ length: 5 }).map((_, index) => <tr key={index}><td className="px-6 py-5"><Skeleton className="h-9 w-52" /></td><td colSpan={isAdmin ? 5 : 4}><Skeleton className="h-7 w-full" /></td></tr>)}
              {!isLoading && filteredParts.map(part => {
                const low = part.quantity < part.minimumStock;
                const meta = categoryMeta[part.category];
                return <tr key={part.id} className="group hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4"><p className="font-semibold text-slate-900">{part.name}</p><p className="font-mono text-xs text-slate-500 mt-1">{part.partNumber}</p></td>
                  <td className="px-4 py-4"><Badge variant="outline" className={`${meta.soft} ${meta.accent} font-medium`}>{meta.label} <span className="ml-1 opacity-70">{meta.arabic}</span></Badge></td>
                  <td className="px-4 py-4 text-sm text-slate-600"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" />{part.location || "Not assigned"}</span></td>
                  <td className="px-4 py-4"><div className={`inline-flex items-center gap-2 font-semibold ${low ? "text-rose-700" : "text-slate-900"}`}>{low && <TriangleAlert className="h-4 w-4" />}{part.quantity} <span className="font-normal text-xs text-slate-500">units</span></div></td>
                  <td className="px-4 py-4 text-sm text-slate-600">{part.minimumStock} units</td>
                  {isAdmin && <td className="px-6 py-4"><div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100"><Button variant="ghost" size="icon" onClick={() => { setEditingPart(part); setDialogOpen(true); }} aria-label={`Edit ${part.name}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(part)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${part.name}`}><Trash2 className="h-4 w-4" /></Button></div></td>}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredParts.length === 0 && <div className="py-16 text-center"><div className="mx-auto w-11 h-11 rounded-xl bg-slate-100 grid place-items-center"><Boxes className="h-5 w-5 text-slate-500" /></div><h2 className="mt-4 font-semibold text-slate-900">No parts found</h2><p className="mt-1 text-sm text-slate-500">{isAdmin ? "Add the first warehouse part or change the current filters." : "Try another search or filter."}</p></div>}
      </section>

      {isAdmin && <PartFormDialog open={dialogOpen} onOpenChange={setDialogOpen} part={editingPart} saving={createPart.isPending || updatePart.isPending} onSave={values => editingPart ? updatePart.mutate({ id: editingPart.id, ...values }) : createPart.mutate(values)} />}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this part?</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.name} will only be removable if it has no recorded requests or movements. This protects the audit history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep part</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && removePart.mutate({ id: deleteTarget.id })} className="bg-rose-600 hover:bg-rose-700">Remove part</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
