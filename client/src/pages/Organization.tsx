import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeOrganizationIdentifier, organizationErrorMessage, validateDepartmentForm, validateEmployeeForm } from "@/lib/organizationValidation";
import { trpc } from "@/lib/trpc";
import { Building2, KeyRound, Pencil, Plus, Search, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DepartmentForm = { name: string; code: string; description: string };
type EmployeeForm = { fullName: string; email: string; employeeCode: string; jobTitle: string; departmentId: string; warehouseRole: "admin" | "engineer" | "viewer" };

const emptyDepartment: DepartmentForm = { name: "", code: "", description: "" };
const emptyEmployee: EmployeeForm = { fullName: "", email: "", employeeCode: "", jobTitle: "", departmentId: "unassigned", warehouseRole: "engineer" };
const roleLabel = (role: EmployeeForm["warehouseRole"]) => ({ admin: "أدمن", engineer: "مستخدم / مهندس", viewer: "مشاهد" }[role]);

export default function Organization({ initialTab = "departments" }: { initialTab?: "departments" | "employees" }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab);

  if (user?.role !== "admin") return <AccessDenied />;

  return <div className="space-y-6">
    <section>
      <p className="eyebrow">إدارة الشركة</p>
      <h1 className="page-title">دليل الشركة</h1>
      <p className="page-subtitle">الأدمن يحدد بريد الموظف ودوره وكود دخوله الأولي؛ لا توجد حسابات عامة خارج دليل الموظفين.</p>
    </section>
    <div className="inline-flex rounded-xl border border-[#E8EEF3] bg-white p-1">
      <button onClick={() => setTab("departments")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "departments" ? "bg-[#0B2E4E] text-white" : "text-slate-500"}`}>الأقسام</button>
      <button onClick={() => setTab("employees")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "employees" ? "bg-[#0B2E4E] text-white" : "text-slate-500"}`}>الموظفون والحسابات</button>
    </div>
    {tab === "departments" ? <DepartmentManager /> : <EmployeeManager />}
  </div>;
}

function DepartmentManager() {
  const utils = trpc.useUtils();
  const { data: departments, isLoading } = trpc.organization.departments.list.useQuery();
  const [form, setForm] = useState<DepartmentForm>(emptyDepartment);
  const [editing, setEditing] = useState<(DepartmentForm & { id: number }) | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => (departments ?? []).filter(item => `${item.name} ${item.code} ${item.description ?? ""}`.toLowerCase().includes(search.toLowerCase())), [departments, search]);
  const refresh = () => utils.organization.departments.list.invalidate();
  const create = trpc.organization.departments.create.useMutation({ onSuccess: async () => { toast.success("تمت إضافة القسم."); setForm(emptyDepartment); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const update = trpc.organization.departments.update.useMutation({ onSuccess: async () => { toast.success("تم تحديث القسم."); setForm(emptyDepartment); setEditing(null); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const archive = trpc.organization.departments.archive.useMutation({ onSuccess: refresh, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const submit = (event: React.FormEvent) => { event.preventDefault(); const message = validateDepartmentForm(form); if (message) return toast.error(message); const values = { name: form.name.trim(), code: normalizeOrganizationIdentifier(form.code), description: form.description.trim() || undefined }; editing ? update.mutate({ id: editing.id, ...values }) : create.mutate(values); };

  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <section className="panel p-6"><SectionTitle icon={<Building2 />} title={editing ? "تعديل القسم" : "إضافة قسم"} description="يمكن إنشاء أي قسم تشغيلي وتعديله أو أرشفته بأمان." />
      <form onSubmit={submit} className="mt-6 space-y-4"><Field label="اسم القسم"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></Field><Field label="رمز القسم"><Input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="3DP أو الهندسة" required /></Field><Field label="الوصف"><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} /></Field><FormButtons editing={Boolean(editing)} pending={create.isPending || update.isPending} onCancel={() => { setEditing(null); setForm(emptyDepartment); }} createLabel="إضافة القسم" saveLabel="حفظ القسم" /></form>
    </section>
    <section className="panel overflow-hidden"><DirectoryHeader title="أقسام الشركة" search={search} setSearch={setSearch} placeholder="ابحث باسم القسم أو رمزه…" /><div className="divide-y divide-[#E8EEF3]">{isLoading && <Loading />}{filtered.map(item => <div key={item.id} className="flex items-center gap-4 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8F4] text-[#00A58D]"><Building2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-[#0B2E4E]">{item.name} <span className="mr-2 font-mono text-xs text-[#0178D4]">{item.code}</span></p><p className="mt-1 text-xs text-slate-500">{item.description || "لا يوجد وصف"}</p></div><Button variant="ghost" size="icon" onClick={() => { setEditing({ id: item.id, name: item.name, code: item.code, description: item.description ?? "" }); setForm({ name: item.name, code: item.code, description: item.description ?? "" }); }} aria-label={`تعديل ${item.name}`}><Pencil className="h-4 w-4" /></Button>{item.isActive ? <Button size="sm" variant="outline" className="border-rose-200 text-rose-700" onClick={() => archive.mutate({ id: item.id })}>أرشفة</Button> : <Badge>مؤرشف</Badge>}</div>)}{!isLoading && !filtered.length && <Empty label="لا توجد أقسام مطابقة للبحث." />}</div></section>
  </div>;
}

function EmployeeManager() {
  const utils = trpc.useUtils();
  const { data: departments } = trpc.organization.departments.list.useQuery();
  const { data: employees, isLoading } = trpc.organization.employees.list.useQuery();
  const [form, setForm] = useState<EmployeeForm>(emptyEmployee);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => (employees ?? []).filter(({ employee, department }) => `${employee.fullName} ${employee.email ?? ""} ${employee.employeeCode} ${employee.jobTitle} ${employee.warehouseRole} ${department?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())), [employees, search]);
  const refresh = () => Promise.all([utils.organization.employees.list.invalidate(), utils.organization.users.list.invalidate()]);
  const create = trpc.organization.employees.create.useMutation({ onSuccess: async () => { toast.success("تمت إضافة الموظف. جهّز له الدخول من الدليل عند الحاجة."); setForm(emptyEmployee); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const update = trpc.organization.employees.update.useMutation({ onSuccess: async () => { toast.success("تم تحديث ملف الموظف."); setForm(emptyEmployee); setEditing(null); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const provision = trpc.organization.employees.provisionAccess.useMutation({ onSuccess: async ({ employeeName, email }) => { toast.success(`تم تجهيز دخول ${employeeName} بالبريد ${email}. سلّم الموظف كود الدخول الذي أنشأته فقط.`); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const suspend = trpc.organization.employees.suspendAccess.useMutation({ onSuccess: async ({ suspendedUntil }) => { toast.success(`تم تعليق الوصول حتى ${new Date(suspendedUntil).toLocaleString("ar-EG")}.`); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const reactivate = trpc.organization.employees.reactivateAccess.useMutation({ onSuccess: async () => { toast.success("تمت إعادة تفعيل الوصول."); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const revoke = trpc.organization.employees.revokeAccess.useMutation({ onSuccess: async () => { toast.success("تم إلغاء الوصول مع الاحتفاظ بسجل المخزن."); await refresh(); }, onError: error => toast.error(organizationErrorMessage(error.message)) });
  const submit = (event: React.FormEvent) => { event.preventDefault(); const message = validateEmployeeForm(form); if (message) return toast.error(message); const values = { ...form, fullName: form.fullName.trim(), email: form.email.trim(), employeeCode: normalizeOrganizationIdentifier(form.employeeCode), jobTitle: form.jobTitle.trim(), departmentId: form.departmentId === "unassigned" ? null : Number(form.departmentId) }; editing ? update.mutate({ id: editing.id, ...values }) : create.mutate(values); };
  const prepare = (employee: any) => { const email = window.prompt("البريد المعتمد للموظف", employee.email ?? ""); if (!email) return; const initialPassword = window.prompt("كود الدخول الأولي (مثال: RT-TECH-ABDELMONEM)"); if (!initialPassword) return; provision.mutate({ employeeId: employee.id, email, initialPassword }); };
  const suspendEmployee = (employee: any) => { const value = window.prompt("تاريخ ووقت انتهاء التعليق بصيغة 2026-12-31T18:00"); if (!value) return; const suspendedUntil = new Date(value); if (Number.isNaN(suspendedUntil.getTime())) return toast.error("أدخل تاريخًا ووقتًا صحيحين."); suspend.mutate({ employeeId: employee.id, suspendedUntil }); };
  const edit = (employee: any) => { setEditing(employee); setForm({ fullName: employee.fullName, email: employee.email ?? "", employeeCode: employee.employeeCode, jobTitle: employee.jobTitle, departmentId: employee.departmentId ? String(employee.departmentId) : "unassigned", warehouseRole: employee.warehouseRole }); };

  return <div className="grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
    <section className="panel p-6"><SectionTitle icon={<UsersRound />} title={editing ? "تعديل موظف" : "إضافة موظف"} description="أنشئ ملف الموظف وحدد البريد والدور. بعد الحفظ جهّز كود دخوله من صف الموظف." />
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="الاسم الكامل"><Input value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} required /></Field></div><Field label="كود الموظف"><Input value={form.employeeCode} onChange={event => setForm({ ...form, employeeCode: event.target.value })} placeholder="ENG-001" required /></Field><Field label="المسمى الوظيفي"><Input value={form.jobTitle} onChange={event => setForm({ ...form, jobTitle: event.target.value })} required /></Field><div className="sm:col-span-2"><Field label="البريد المعتمد للحساب"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="employee@company.com" /><p className="text-[11px] text-slate-500">لا يقبل النظام أي بريد غير مسجل هنا. اكتب كود الدخول الأولي عند الضغط على «تجهيز الدخول».</p></Field></div><Field label="القسم"><Select value={form.departmentId} onValueChange={value => setForm({ ...form, departmentId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">غير محدد</SelectItem>{departments?.filter(item => item.isActive).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label="صلاحية المخزن"><Select value={form.warehouseRole} onValueChange={value => setForm({ ...form, warehouseRole: value as EmployeeForm["warehouseRole"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="engineer">مستخدم / مهندس</SelectItem><SelectItem value="viewer">مشاهد</SelectItem><SelectItem value="admin">أدمن</SelectItem></SelectContent></Select></Field><div className="sm:col-span-2"><FormButtons editing={Boolean(editing)} pending={create.isPending || update.isPending} onCancel={() => { setEditing(null); setForm(emptyEmployee); }} createLabel="إضافة الموظف" saveLabel="حفظ الموظف" /></div></form>
    </section>
    <section className="panel overflow-hidden"><DirectoryHeader title="الموظفون والحسابات" search={search} setSearch={setSearch} placeholder="ابحث بالاسم أو الكود أو البريد أو الدور…" /><div className="divide-y divide-[#E8EEF3]">{isLoading && <Loading />}{filtered.map(({ employee, department }) => <EmployeeRow key={employee.id} employee={employee} departmentName={department?.name} onPrepare={prepare} onEdit={edit} onSuspend={suspendEmployee} onReactivate={() => reactivate.mutate({ employeeId: employee.id })} onRevoke={() => { if (window.confirm(`إلغاء وصول ${employee.fullName} مع الاحتفاظ بسجل المخزن؟`)) revoke.mutate({ employeeId: employee.id }); }} pending={{ provision: provision.isPending, suspend: suspend.isPending, reactivate: reactivate.isPending, revoke: revoke.isPending }} />)}{!isLoading && !filtered.length && <Empty label="لا يوجد موظفون مطابقون للبحث." />}</div></section>
  </div>;
}

function EmployeeRow({ employee, departmentName, onPrepare, onEdit, onSuspend, onReactivate, onRevoke, pending }: { employee: any; departmentName?: string | null; onPrepare: (employee: any) => void; onEdit: (employee: any) => void; onSuspend: (employee: any) => void; onReactivate: () => void; onRevoke: () => void; pending: { provision: boolean; suspend: boolean; reactivate: boolean; revoke: boolean } }) {
  const suspended = Boolean(employee.suspendedUntil && new Date(employee.suspendedUntil) > new Date());
  const status = !employee.isActive ? "تم إلغاء الوصول" : suspended ? `معلّق حتى ${new Date(employee.suspendedUntil).toLocaleDateString("ar-EG")}` : employee.userId ? "حساب مفعّل" : employee.initialPasswordIssuedAt ? "جاهز للتفعيل" : "يحتاج تجهيز الدخول";
  const statusClass = !employee.isActive ? "border-rose-200 bg-rose-50 text-rose-700" : suspended ? "border-amber-200 bg-amber-50 text-amber-700" : employee.userId ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#d9d0bf] text-[#8a7a60]";
  return <article className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7F3FE] font-bold text-[#0178D4]">{employee.fullName.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#0B2E4E]">{employee.fullName}</p><Badge className="border-[#B9DAF7] text-[#0178D4]">{roleLabel(employee.warehouseRole)}</Badge><Badge className={statusClass}>{status}</Badge></div><p className="mt-1 text-xs text-slate-500">{employee.jobTitle} · {departmentName || "بلا قسم"}</p><p className="mt-1 font-mono text-xs text-slate-400">{employee.employeeCode} · {employee.email || "بلا بريد معتمد"}</p></div><div className="flex flex-wrap gap-2">{employee.isActive && !employee.userId && <Button size="sm" variant="outline" className="gap-1 border-[#d0b27a] text-[#8a642c]" onClick={() => onPrepare(employee)} disabled={pending.provision}><KeyRound className="h-3.5 w-3.5" />تجهيز الدخول</Button>}{employee.isActive && employee.userId && (suspended ? <Button size="sm" variant="outline" className="gap-1 border-emerald-200 text-emerald-700" onClick={onReactivate} disabled={pending.reactivate}><UserRoundCheck className="h-3.5 w-3.5" />تفعيل</Button> : <Button size="sm" variant="outline" className="border-amber-200 text-amber-700" onClick={() => onSuspend(employee)} disabled={pending.suspend}>تعليق</Button>)}<Button size="sm" variant="outline" onClick={() => onEdit(employee)} aria-label={`تعديل ${employee.fullName}`}><Pencil className="h-3.5 w-3.5" /></Button>{employee.isActive && <Button size="sm" variant="outline" className="gap-1 border-rose-200 text-rose-700" onClick={onRevoke} disabled={pending.revoke}><UserRoundX className="h-3.5 w-3.5" />إلغاء الوصول</Button>}</div></article>;
}

function AccessDenied() { return <div className="panel mx-auto max-w-2xl p-12 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-[#0178D4]" /><h1 className="mt-4 text-xl font-bold text-[#0B2E4E]">صلاحية أدمن مطلوبة</h1><p className="mt-2 text-sm text-slate-500">إدارة الأقسام والموظفين متاحة لمسؤولي المخزن فقط.</p></div>; }
function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8F4] text-[#00A58D]">{icon}</div><div><h2 className="font-bold text-[#0B2E4E]">{title}</h2><p className="text-xs text-slate-500">{description}</p></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function FormButtons({ editing, pending, onCancel, createLabel, saveLabel }: { editing: boolean; pending: boolean; onCancel: () => void; createLabel: string; saveLabel: string }) { return <div className="flex gap-2"><Button type="submit" className="gap-2 bg-[#0178D4] text-white hover:bg-[#0065B3]" disabled={pending}><Plus className="h-4 w-4" />{editing ? saveLabel : createLabel}</Button>{editing && <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button>}</div>; }
function DirectoryHeader({ title, search, setSearch, placeholder }: { title: string; search: string; setSearch: (value: string) => void; placeholder: string }) { return <div className="border-b border-[#E8EEF3] p-6"><p className="eyebrow">دليل قابل للبحث</p><h2 className="mt-1 font-bold text-[#0B2E4E]">{title}</h2><div className="relative mt-4"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} className="bg-white pr-9" placeholder={placeholder} /></div></div>; }
function Loading() { return <div className="p-6 text-sm text-slate-500">يجري تحميل السجلات…</div>; }
function Empty({ label }: { label: string }) { return <div className="p-10 text-center text-sm text-slate-500">{label}</div>; }
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${className}`}>{children}</span>; }
