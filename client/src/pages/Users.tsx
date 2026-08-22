import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Activity, BellRing, ClipboardList, FileText, Search, ShieldCheck, Trash2, UserRound, UsersRound, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const roleLabel = (role: "admin" | "user") => role === "admin" ? "أدمن" : "مستخدم";
const statusLabel = (status: string) => ({ pending: "بانتظار القرار", approved: "معتمد ومحجوز", delivered: "تم التسليم", rejected: "مرفوض" }[status] ?? status);
const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "لا يوجد تسجيل";

export default function Users() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [employeeToLinkId, setEmployeeToLinkId] = useState("");
  const { data: accounts, isLoading } = trpc.organization.users.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const { data: employees } = trpc.organization.employees.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const { data: departments } = trpc.organization.departments.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const { data: activity, isLoading: isLoadingActivity } = trpc.organization.users.activity.useQuery({ userId: selectedUserId ?? 0 }, { enabled: selectedUserId !== null && user?.role === "admin" });
  const utils = trpc.useUtils();
  const linkAccount = trpc.organization.employees.linkAccount.useMutation({ onSuccess: async () => { setEmployeeToLinkId(""); await Promise.all([utils.organization.users.list.invalidate(), utils.organization.users.activity.invalidate(), utils.organization.employees.list.invalidate()]); } });
  const deleteNormalAccount = trpc.organization.users.deleteNormalAccount.useMutation({ onSuccess: async () => { setSelectedUserId(null); toast.success("تم حذف حساب المستخدم من النظام مع الاحتفاظ بسجل المخزن."); await Promise.all([utils.organization.users.list.invalidate(), utils.organization.employees.list.invalidate()]); }, onError: error => toast.error(error.message) });

  const filtered = useMemo(() => (accounts ?? []).filter(({ account, employee, department }) => {
    const haystack = `${account.name ?? ""} ${account.email ?? ""} ${account.role} ${employee?.employeeCode ?? ""} ${employee?.jobTitle ?? ""} ${department?.name ?? ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase()) && (departmentFilter === "all" || String(department?.id) === departmentFilter);
  }), [accounts, search, departmentFilter]);

  if (user?.role !== "admin") return <div className="panel mx-auto max-w-2xl p-12 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-[#a97937]" /><h1 className="mt-4 text-xl font-bold text-[#18354a]">صلاحية أدمن مطلوبة</h1><p className="mt-2 text-sm text-slate-500">دليل الحسابات والأنشطة التشغيلية متاح لمسؤولي المخزن فقط.</p></div>;

  const adminCount = accounts?.filter(row => row.account.role === "admin").length ?? 0;
  const userCount = accounts?.filter(row => row.account.role === "user").length ?? 0;
  const totalActivities = accounts?.reduce((sum, row) => sum + row.summary.activityCount, 0) ?? 0;

  return <div className="space-y-6">
    <section><p className="eyebrow">إدارة الحسابات</p><h1 className="page-title">المستخدمون والنشاطات</h1><p className="page-subtitle">راجع كل حساب مُسجّل، صلاحياته، آخر دخول، وملخص طلباته وتسليماته وسجل حركته. هذه الصفحة متاحة للأدمن فقط.</p></section>

    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={UsersRound} label="إجمالي الحسابات" value={accounts?.length ?? 0} tone="blue" />
      <Metric icon={ShieldCheck} label="حسابات الأدمن" value={adminCount} tone="bronze" detail={`${userCount} مستخدم عادي`} />
      <Metric icon={Activity} label="الأنشطة المسجلة" value={totalActivities} tone="emerald" detail="من سجل حركة المخزن" />
    </div>

    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
      <section className="panel overflow-hidden">
        <div className="border-b border-[#d9d0bf] p-6"><p className="eyebrow">دليل الحسابات</p><h2 className="mt-1 font-bold text-[#18354a]">كل الأدمن والمستخدمين</h2><div className="relative mt-4"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94713d]" /><Input value={search} onChange={event => setSearch(event.target.value)} className="bg-white pr-9" placeholder="ابحث بالاسم أو البريد أو الصلاحية أو القسم…" /></div><Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="mt-3 bg-white"><SelectValue placeholder="فلترة حسب القسم" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأقسام</SelectItem>{departments?.map(department => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="divide-y divide-[#ece6d9]">
          {isLoading && <div className="p-8 text-sm text-slate-500">يجري تحميل الحسابات…</div>}
          {!isLoading && filtered.map(({ account, employee, department, summary }) => <button key={account.id} type="button" onClick={() => { setSelectedUserId(account.id); setEmployeeToLinkId(""); }} className={`w-full p-5 text-right transition-colors hover:bg-[#fcf8ef] ${selectedUserId === account.id ? "bg-[#f7eedc]" : ""}`}>
            <div className="flex items-start gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-heading font-extrabold ${account.role === "admin" ? "bg-[#17374c] text-white" : "bg-[#e7f3fe] text-[#0b5798]"}`}>{(account.name || account.email || "م").charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#18354a]">{account.name || "حساب بلا اسم"}</p><Badge className={account.role === "admin" ? "border-[#b58a4a] bg-[#fff7e8] text-[#8a642c]" : "border-[#b9daf7] bg-[#f1f8fe] text-[#0b5798]"}>{roleLabel(account.role)}</Badge></div><p className="mt-1 truncate text-xs text-slate-500" dir="ltr">{account.email || "لا يوجد بريد ظاهر"}</p><p className="mt-1 text-xs text-slate-500">{employee ? `${employee.jobTitle} · ${department?.name || "بلا قسم"}` : "لا يوجد ملف موظف مرتبط"}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#6e6a60]"><span className="rounded-md bg-[#f4f0e8] px-2 py-1">طلبات: {summary.requestCount}</span><span className="rounded-md bg-[#f4f0e8] px-2 py-1">تسليم: {summary.receivedInvoiceCount}</span><span className="rounded-md bg-[#f4f0e8] px-2 py-1">نشاط: {summary.activityCount}</span>{summary.unreadAlertCount > 0 && <span className="rounded-md bg-[#fff0ed] px-2 py-1 text-[#b54b3e]">تنبيهات غير مقروءة: {summary.unreadAlertCount}</span>}</div></div><span className="mt-1 whitespace-nowrap text-[10px] text-slate-400">آخر دخول<br />{formatDate(account.lastSignedIn)}</span></div>
          </button>)}
          {!isLoading && !filtered.length && <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات مطابقة للبحث.</div>}
        </div>
      </section>

      <section className="panel overflow-hidden">
        {!selectedUserId && <div className="flex min-h-[32rem] flex-col items-center justify-center p-10 text-center"><UserRound className="h-8 w-8 text-[#b58a4a]" /><h2 className="mt-4 font-bold text-[#18354a]">اختر مستخدمًا لعرض نشاطه</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">سيظهر سجل طلباته وفواتيره وتحركاته وتنبيهاته الشخصية وسجل نشاطه المرتبط بالمخزن.</p></div>}
        {selectedUserId && isLoadingActivity && <div className="p-10 text-sm text-slate-500">يجري تحميل سجل نشاط المستخدم…</div>}
        {selectedUserId && activity && <UserActivity activity={activity} unlinkedEmployees={(employees ?? []).filter(({ employee }) => employee.isActive && !employee.userId)} selectedEmployeeId={employeeToLinkId} onSelectEmployee={setEmployeeToLinkId} onLink={() => employeeToLinkId && linkAccount.mutate({ employeeId: Number(employeeToLinkId), userId: selectedUserId })} linking={linkAccount.isPending} onDeleteAccount={() => { if (window.confirm(`حذف حساب ${activity.account.name || "المستخدم"} من النظام؟ سيُمنع الدخول مع الاحتفاظ بكل طلبات وفواتير وسجل المخزن.`)) deleteNormalAccount.mutate({ userId: selectedUserId }); }} deleting={deleteNormalAccount.isPending} />}
      </section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, tone, detail }: { icon: typeof UsersRound; label: string; value: number; tone: "blue" | "bronze" | "emerald"; detail?: string }) {
  const styles = { blue: "border-[#b9daf7] bg-[#f1f8fe] text-[#0b5798]", bronze: "border-[#e4cca1] bg-[#fff7e8] text-[#8a642c]", emerald: "border-[#b7e1d9] bg-[#edf9f6] text-[#007b68]" }[tone];
  return <div className="panel flex items-center gap-4 p-5"><div className={`grid h-11 w-11 place-items-center rounded-xl border ${styles}`}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-extrabold text-[#18354a]">{value}</p><p className="text-sm font-semibold text-[#18354a]">{label}</p>{detail && <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>}</div></div>;
}

function UserActivity({ activity, unlinkedEmployees, selectedEmployeeId, onSelectEmployee, onLink, linking, onDeleteAccount, deleting }: { activity: any; unlinkedEmployees: any[]; selectedEmployeeId: string; onSelectEmployee: (value: string) => void; onLink: () => void; linking: boolean; onDeleteAccount: () => void; deleting: boolean }) {
  const { account, employee, department, requests, invoices, transactions, alerts, activities } = activity;
  return <div><div className="border-b border-[#d9d0bf] bg-[#fcf8ef] p-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#17374c] font-heading font-extrabold text-white">{(account.name || account.email || "م").charAt(0)}</div><div><p className="font-bold text-[#18354a]">{account.name || "حساب بلا اسم"}</p><p className="mt-1 text-xs text-slate-500">{roleLabel(account.role)} · {employee ? `${employee.jobTitle} · ${department?.name || "بلا قسم"}` : "لا يوجد ملف موظف مرتبط"}</p></div></div><p className="mt-3 text-xs text-slate-500" dir="ltr">{account.email || ""}</p>{account.role === "user" && <Button type="button" variant="outline" className="mt-4 gap-2 border-rose-300 text-rose-700 hover:bg-rose-50" onClick={onDeleteAccount} disabled={deleting}><Trash2 className="h-4 w-4" />{deleting ? "يجري حذف الحساب…" : "حذف حساب المستخدم"}</Button>}{!employee && <div className="mt-4 rounded-xl border border-[#e4cca1] bg-[#fff9ec] p-4"><p className="text-sm font-bold text-[#7b5a2d]">ربط الحساب بموظف</p><p className="mt-1 text-xs leading-5 text-[#8a7a60]">اختر ملف موظف غير مرتبط. سيصبح اسمه وصلاحيته هما بيانات هذا الحساب داخل المخزن.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Select value={selectedEmployeeId} onValueChange={onSelectEmployee}><SelectTrigger className="bg-white"><SelectValue placeholder="اختر موظفًا غير مرتبط" /></SelectTrigger><SelectContent>{unlinkedEmployees.map(({ employee }: any) => <SelectItem key={employee.id} value={String(employee.id)}>{employee.fullName} · {employee.employeeCode}</SelectItem>)}</SelectContent></Select><Button type="button" disabled={!selectedEmployeeId || linking} onClick={onLink} className="bg-[#a97937] text-white hover:bg-[#91642d]">{linking ? "يجري الربط…" : "ربط الحساب"}</Button></div>{!unlinkedEmployees.length && <p className="mt-2 text-xs text-slate-500">لا توجد ملفات موظفين نشطة غير مرتبطة حاليًا.</p>}</div>}</div>
    <div className="grid gap-3 border-b border-[#ece6d9] p-5 sm:grid-cols-2"><Count icon={ClipboardList} label="طلبات الصرف" value={requests.length} /><Count icon={FileText} label="فواتير مرتبطة" value={invoices.length} /><Count icon={Warehouse} label="حركات مخزون" value={transactions.length} /><Count icon={BellRing} label="تنبيهات شخصية" value={alerts.length} /></div>
    <div className="max-h-[38rem] space-y-6 overflow-y-auto p-5"><ActivitySection icon={ClipboardList} title="طلبات الصرف" empty="لا توجد طلبات صرف لهذا المستخدم." items={requests} render={(item: any) => <><p className="font-semibold text-[#18354a]">{item.part.name} <span className="font-mono text-xs text-slate-400">{item.part.partNumber}</span></p><p className="mt-1 text-xs text-slate-500">{statusLabel(item.request.status)} · {item.request.requestedQuantity} وحدة · {formatDate(item.request.createdAt)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.request.purpose}</p></>} />
      <ActivitySection icon={Activity} title="سجل الحركة" empty="لا توجد أنشطة مسجلة لهذا المستخدم." items={activities} render={(item: any) => <><p className="font-semibold text-[#18354a]">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail || "لا توجد تفاصيل إضافية"}</p><p className="mt-1 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p></>} />
      <ActivitySection icon={FileText} title="الفواتير" empty="لا توجد فواتير مرتبطة بهذا المستخدم." items={invoices} render={(item: any) => <><p className="font-semibold text-[#18354a]">{item.invoiceNumber}</p><p className="mt-1 text-xs text-slate-500">{item.partNameSnapshot} · {item.quantity} وحدة · {formatDate(item.issuedAt)}</p></>} />
      <ActivitySection icon={Warehouse} title="حركات المخزون" empty="لا توجد حركات مخزون مرتبطة بهذا المستخدم." items={transactions} render={(item: any) => <><p className="font-semibold text-[#18354a]">{item.partNameSnapshot}</p><p className="mt-1 text-xs text-slate-500">{item.type} · التغيير {item.quantityDelta} · {formatDate(item.createdAt)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.details || "لا توجد تفاصيل إضافية"}</p></>} />
      <ActivitySection icon={BellRing} title="التنبيهات الشخصية" empty="لا توجد تنبيهات شخصية لهذا المستخدم." items={alerts} render={(item: any) => <><p className="font-semibold text-[#18354a]">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p><p className="mt-1 text-[11px] text-slate-400">{item.isRead ? "تمت القراءة" : "غير مقروء"} · {formatDate(item.createdAt)}</p></>} />
    </div>
  </div>;
}

function Count({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) { return <div className="rounded-lg border border-[#e6dfd0] bg-white p-3"><div className="flex items-center gap-2 text-[#94713d]"><Icon className="h-4 w-4" /><span className="text-xs font-semibold">{label}</span></div><p className="mt-2 text-xl font-extrabold text-[#18354a]">{value}</p></div>; }
function ActivitySection({ icon: Icon, title, empty, items, render }: { icon: typeof ClipboardList; title: string; empty: string; items: any[]; render: (item: any) => React.ReactNode }) { return <section><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#a97937]" /><h3 className="font-bold text-[#18354a]">{title}</h3><span className="rounded-full bg-[#f4f0e8] px-2 py-0.5 text-[10px] font-bold text-[#6e6a60]">{items.length}</span></div>{items.length ? <div className="mt-3 space-y-2">{items.slice(0, 8).map((item, index) => <div key={item.id ?? index} className="rounded-lg border border-[#ece6d9] bg-white p-3">{render(item)}</div>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-[#d9d0bf] p-3 text-xs text-slate-500">{empty}</p>}</section>; }
function Badge({ children, className }: { children: React.ReactNode; className: string }) { return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${className}`}>{children}</span>; }
