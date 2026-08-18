import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categoryMeta } from "@/lib/warehouse";
import { useEffect, useState } from "react";

export type EditablePart = {
  id: number;
  partNumber: string;
  name: string;
  description: string | null;
  category: "Medical" | "Embedded" | "Electronics" | "Boards";
  quantity: number;
  minimumStock: number;
  location: string | null;
};

type PartFormValues = {
  partNumber: string;
  name: string;
  description: string;
  category: EditablePart["category"];
  quantity: number;
  minimumStock: number;
  location: string;
};

const emptyPart: PartFormValues = {
  partNumber: "",
  name: "",
  description: "",
  category: "Electronics",
  quantity: 0,
  minimumStock: 0,
  location: "",
};

export default function PartFormDialog({
  open,
  onOpenChange,
  part,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: EditablePart | null;
  saving: boolean;
  onSave: (values: PartFormValues) => void;
}) {
  const [form, setForm] = useState<PartFormValues>(emptyPart);

  useEffect(() => {
    setForm(part ? {
      partNumber: part.partNumber,
      name: part.name,
      description: part.description ?? "",
      category: part.category,
      quantity: part.quantity,
      minimumStock: part.minimumStock,
      location: part.location ?? "",
    } : emptyPart);
  }, [part, open]);

  const setField = <K extends keyof PartFormValues>(key: K, value: PartFormValues[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.partNumber.trim() || !form.name.trim()) return;
    onSave({ ...form, partNumber: form.partNumber.trim(), name: form.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-5 border-b border-slate-100 bg-slate-50/70">
          <p className="eyebrow">Inventory record</p>
          <DialogTitle className="text-xl text-slate-950">{part ? "Edit part details" : "Add a warehouse part"}</DialogTitle>
          <DialogDescription className="text-slate-500">Keep quantities and minimum thresholds current so the stock alerts remain accurate.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="part-number">Part number</Label>
              <Input id="part-number" value={form.partNumber} onChange={event => setField("partNumber", event.target.value)} placeholder="e.g. STM32F407VGT6" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-name">Part name</Label>
              <Input id="part-name" value={form.name} onChange={event => setField("name", event.target.value)} placeholder="e.g. 32-bit microcontroller" required />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={value => setField("category", value as PartFormValues["category"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryMeta).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label} — {meta.arabic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-location">Storage location</Label>
              <Input id="part-location" value={form.location} onChange={event => setField("location", event.target.value)} placeholder="e.g. A-03 / Bin 11" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="part-quantity">Available quantity</Label>
              <Input id="part-quantity" type="number" min="0" value={form.quantity} onChange={event => setField("quantity", Math.max(0, Number(event.target.value)))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum-stock">Minimum threshold</Label>
              <Input id="minimum-stock" type="number" min="0" value={form.minimumStock} onChange={event => setField("minimumStock", Math.max(0, Number(event.target.value)))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="part-description">Description and specifications</Label>
            <Textarea id="part-description" value={form.description} onChange={event => setField("description", event.target.value)} placeholder="Package, value, compatibility, supplier reference, or any important handling note." rows={4} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-slate-950 hover:bg-slate-800 text-white">{saving ? "Saving…" : part ? "Save changes" : "Add part"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
