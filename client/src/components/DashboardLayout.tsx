import { useAuth } from "@/_core/hooks/useAuth";
import { hasSupabaseConfiguration, isPasswordRecoveryLink, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  BellRing,
  DatabaseBackup,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  History,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PanelRight,
  Wrench,
  Shapes,
  Tags,
  Users,
  UsersRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "لوحة المتابعة", path: "/" },
  { icon: Boxes, label: "المكونات", path: "/inventory" },
  { icon: Shapes, label: "أنواع المكونات", path: "/component-types" },
  { icon: Tags, label: "تصنيفات المخزون", path: "/inventory-categories" },
  { icon: Package, label: "المنتجات", path: "/products" },
  { icon: Building2, label: "الشركات", path: "/companies" },
  { icon: ClipboardList, label: "طلبات الصرف", path: "/requests" },
  { icon: HandHeart, label: "عُهد الموظفين", path: "/custody" },
  { icon: FileText, label: "الفواتير", path: "/invoices" },
  { icon: Building2, label: "الأقسام", path: "/departments" },
  { icon: UsersRound, label: "الموظفون", path: "/employees" },
  { icon: Users, label: "المستخدمون", path: "/users" },
  { icon: History, label: "سجل الحركة", path: "/transactions" },
  { icon: Wrench, label: "عمليات الصيانة والشراء", path: "/operations" },
  { icon: DatabaseBackup, label: "النسخ والاستعادة", path: "/backup" },
];

const engineerMenuItems = [
  { icon: LayoutDashboard, label: "مساحة عملي", path: "/" },
  { icon: Boxes, label: "المكونات", path: "/inventory" },
  { icon: Package, label: "المنتجات", path: "/products" },
  { icon: ClipboardList, label: "طلباتي", path: "/my-requests" },
  { icon: HandHeart, label: "عُهدتي", path: "/custody" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const WAREHOUSE_APP_ICON = "/manus-storage/reverse-tech-warehouse-icon-hq_0336c499.png";
let notificationAudioContext: AudioContext | null = null;

function playNotificationTone() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    const context = notificationAudioContext ?? new window.AudioContext();
    notificationAudioContext = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch {
    // Audio can be unavailable until the browser receives a user gesture.
  }
}

function notificationCategory(type: string, isAdmin: boolean) {
  if (isAdmin) {
    if (type === "low_stock") return "تنبيه مخزون";
    if (type === "overdue_request") return "طلب متأخر";
    if (type === "receipt_confirmation_pending") return "استلام معلق";
    if (type === "purchase_received") return "توريد مخزون";
    if (type === "maintenance_returned") return "صيانة ومرتجعات";
    if (type === "assembly_completed") return "أمر تجميع";
    return "تشغيل المخزن";
  }
  if (type === "request_approved") return "تمت الموافقة";
  if (type === "request_rejected") return "تم رفض الطلب";
  return "تسليم وفاتورة";
}

function canonicalEmployeeCodeForSignIn(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^RT-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(normalized) ? normalized : null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || `${DEFAULT_WIDTH}`, 10));
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(isPasswordRecoveryLink);
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecoveryActive(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const completePasswordRecovery = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    setPasswordRecoveryActive(false);
  };

  if (loading) return <DashboardLayoutSkeleton />;
  if (passwordRecoveryActive) return <SupabaseAuthScreen recoveryMode onRecoveryComplete={completePasswordRecovery} />;
  if (!user) return <SupabaseAuthScreen />;

  return (
    <SidebarProvider dir="rtl" style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function SupabaseAuthScreen({ recoveryMode = false, onRecoveryComplete }: { recoveryMode?: boolean; onRecoveryComplete?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const enrollment = trpc.organization.enrollment.claim.useMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const approvedEmail = email.trim().toLowerCase();
    const activationCode = password.trim().toUpperCase().replace(/\s+/g, "");
    if (mode === "signup") {
      try {
        const eligibility = await enrollment.mutateAsync({ email: approvedEmail, password: activationCode });
        if (!eligibility.eligible) {
          setSubmitting(false);
          return setMessage(eligibility.message);
        }
      } catch {
        setSubmitting(false);
        return setMessage("تعذر التحقق من ملف الموظف الآن. حاول مرة أخرى أو تواصل مع مسؤول المخزن.");
      }
    }
    let result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: approvedEmail, password })
      : await supabase.auth.signUp({ email: approvedEmail, password: activationCode, options: { data: { registration_source: "employee_directory" }, emailRedirectTo: window.location.origin } });
    const canonicalEmployeeCode = mode === "signin" ? canonicalEmployeeCodeForSignIn(password) : null;
    if (mode === "signin" && result.error && canonicalEmployeeCode && canonicalEmployeeCode !== password) {
      result = await supabase.auth.signInWithPassword({ email: approvedEmail, password: canonicalEmployeeCode });
    }
    setSubmitting(false);
    if (result.error) {
      const authError = result.error.message.toLowerCase();
      if (authError.includes("email rate limit")) return setMessage("تم تجاوز حد رسائل تأكيد البريد المؤقت في Supabase، وليس هناك خطأ في البريد أو كود الموظف. توقّف عن المحاولة الآن واطلب من الأدمن تجهيز الحساب من لوحة Supabase أو الانتظار حتى ينقضي الحد.");
      return setMessage(authError.includes("already registered") ? "هذا البريد لديه حساب سابقًا. استخدم «تسجيل الدخول»، أو اطلب من الأدمن إعادة ضبط كلمة المرور من Supabase عند الحاجة." : result.error.message);
    }
    setMessage(mode === "signup" && !result.data.session ? "تم إنشاء الحساب. يُرجى تأكيد بريدك الإلكتروني ثم تسجيل الدخول." : "تم تسجيل الدخول. يجري فتح مساحة العمل…");
  };

  const submitPasswordRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) return setMessage("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.");
    if (password !== passwordConfirmation) return setMessage("تأكيد كلمة المرور غير مطابق.");
    setSubmitting(true);
    setMessage("");
    const result = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (result.error) return setMessage("تعذر تحديث كلمة المرور. افتح أحدث رابط استعادة من البريد ثم أعد المحاولة.");
    setMessage("تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.");
    await supabase.auth.signOut({ scope: "local" });
    onRecoveryComplete?.();
  };

  const title = recoveryMode ? "تعيين كلمة مرور جديدة" : mode === "signin" ? "تسجيل الدخول إلى إدارة المخزن" : "تفعيل حساب الموظف";
  const subtitle = recoveryMode ? "اكتب كلمة مرور جديدة لحساب REVERSE TECH ثم سجّل الدخول بها." : "منصة REVERSE TECH الداخلية لإدارة المخزون والطلبات.";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f4f0e8] p-5 before:absolute before:inset-y-0 before:right-[8%] before:w-px before:bg-[#b58a4a]/20 after:absolute after:inset-x-0 after:bottom-0 after:h-32 after:bg-[linear-gradient(135deg,transparent_0%,transparent_47%,rgba(181,138,74,.06)_47%,rgba(181,138,74,.06)_53%,transparent_53%,transparent_100%)]">
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[#d8cdbb] bg-[#fffefa] shadow-[0_22px_52px_rgba(31,42,52,.16)]">
        <div className="relative overflow-hidden border-b-4 border-[#b58a4a] bg-[#17374c] p-7 sm:p-8">
          <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(90deg,transparent,transparent_15px,rgba(255,255,255,.12)_16px)]" />
          <div className="absolute left-7 top-7 font-mono text-[9px] tracking-[.18em] text-[#dfc488]/80">RT · WMS · 01</div>
          <div className="group relative inline-flex h-16 w-16 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
            <img src={WAREHOUSE_APP_ICON} alt="أيقونة مخزن REVERSE TECH" className="h-full w-full object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,.18)] transition duration-300 ease-out group-hover:-rotate-3 group-hover:scale-110" />
          </div>
          <p className="relative mt-6 text-[10px] font-bold tracking-[.16em] text-[#dfc488]">تحليل · تصميم · تصنيع</p>
          <h1 className="relative mt-2 text-[1.7rem] font-extrabold leading-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#CDE8FA]">{subtitle}</p>
        </div>
        <form onSubmit={recoveryMode ? submitPasswordRecovery : submit} className="space-y-4 p-7 sm:p-8">
          <div className="flex items-center gap-3 text-[10px] font-bold tracking-[.14em] text-[#94713d]"><span className="h-px flex-1 bg-[#d9c79d]" />بوابة العمليات الداخلية<span className="h-px flex-1 bg-[#d9c79d]" /></div>
          {recoveryMode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="recovery-password">كلمة المرور الجديدة</Label>
                <Input id="recovery-password" type="password" minLength={6} value={password} onChange={event => setPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-password-confirmation">تأكيد كلمة المرور الجديدة</Label>
                <Input id="recovery-password-confirmation" type="password" minLength={6} value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} required />
              </div>
            </>
          ) : (
            <>
          {mode === "signup" && (
            <>
              <div className="rounded-lg border border-[#d9c79d] bg-[#fcf8ef] p-3 text-right">
                <span className="flex items-center gap-2 text-sm font-bold text-[#0B2E4E]"><Mail className="h-4 w-4 text-[#a97937]" />بريد وكلمة مرور</span>
                <span className="mt-1 block text-[11px] leading-5 text-slate-600">الأدمن يضيف البريد والدور وكود الدخول أولًا. اكتب البريد المسجل وكود الدخول نفسه؛ ولا يقبل النظام بريدًا خارج دليل الموظفين. الاسم والصلاحية يؤخذان تلقائيًا من ملف الموظف.</span>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="auth-email">البريد الإلكتروني</Label>
            <Input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">{mode === "signup" ? "كود الدخول الذي حدده الأدمن" : "كلمة المرور / كود الدخول"}</Label>
            <Input id="auth-password" type="password" minLength={6} maxLength={64} value={password} onChange={event => setPassword(event.target.value)} required />
          </div>
            </>
          )}
          {message && <p className="rounded-lg border border-[#B9DAF7] bg-[#F1F8FE] px-3 py-2 text-sm text-[#0B5798]">{message}</p>}
          <Button type="submit" disabled={submitting || !hasSupabaseConfiguration} className="w-full border border-[#c99e5b] bg-[#a97937] text-white shadow-[0_5px_0_#7a5528] transition-[transform,box-shadow,background-color] duration-150 hover:bg-[#91642d] active:translate-y-px active:shadow-[0_3px_0_#7a5528]">
            {submitting ? "يرجى الانتظار…" : recoveryMode ? "حفظ كلمة المرور الجديدة" : mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </Button>
          {!recoveryMode && <p className="text-center text-sm text-slate-500">
            {mode === "signin" ? "موظف مسجل في الدليل؟" : "لدي حساب بالفعل؟"}{" "}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="font-semibold text-[#0178D4] hover:underline">
              {mode === "signin" ? "تفعيل الحساب" : "تسجيل الدخول"}
            </button>
          </p>}
        </form>
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = user?.role === "admin" ? adminMenuItems : engineerMenuItems;
  const activeMenuItem = menuItems.find(item => item.path === location);
  const requestRoute = user?.role === "admin" ? "/requests" : "/my-requests";
  const utils = trpc.useUtils();
  const { data: alerts } = trpc.warehouse.alerts.list.useQuery(undefined, { refetchInterval: 15_000, refetchIntervalInBackground: false });
  const markAlertRead = trpc.warehouse.alerts.markRead.useMutation({ onSuccess: () => utils.warehouse.alerts.list.invalidate() });
  const unreadAlerts = alerts?.filter(alert => !alert.isRead) ?? [];
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(() => localStorage.getItem("reverse-tech-notification-sound") === "enabled");
  const knownAlertIds = useRef<Set<number> | null>(null);
  const isAdmin = user?.role === "admin";
  const notificationTitle = isAdmin ? "تنبيهات إدارة المخزن" : "تنبيهات طلباتي";
  const notificationDescription = isAdmin ? "طلبات وتنبيهات رصيد وصيانة وشراء وتجميع تحتاج متابعة" : "تغيرات حالة طلباتك والتسليمات والفواتير";
  const unreadAlertLabel = unreadAlerts.length ? `${unreadAlerts.length} غير مقروءة` : "لا توجد إشعارات غير مقروءة";

  useEffect(() => {
    const currentIds = new Set((alerts ?? []).map(alert => alert.id));
    const previousIds = knownAlertIds.current;
    if (previousIds && notificationSoundEnabled && unreadAlerts.some(alert => !previousIds.has(alert.id))) playNotificationTone();
    knownAlertIds.current = currentIds;
  }, [alerts, notificationSoundEnabled, unreadAlerts]);

  const toggleNotificationSound = () => {
    const nextValue = !notificationSoundEnabled;
    setNotificationSoundEnabled(nextValue);
    localStorage.setItem("reverse-tech-notification-sound", nextValue ? "enabled" : "disabled");
    if (nextValue) playNotificationTone();
  };

  const switchAccount = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      window.location.replace("/");
    }
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const right = sidebarRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      const width = right - event.clientX;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar side="right" collapsible="icon" className="border-l-0 bg-[#17374c] text-[#ecdfc4]" disableTransition={isResizing}>
          <SidebarHeader className="h-24 justify-center border-b-2 border-[#a9844b] bg-[#193b52]">
            <div className="flex w-full items-center gap-3 px-2">
              <button onClick={toggleSidebar} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c79d]" aria-label="طي أو توسيع التنقل">
                <PanelRight className="h-4 w-4 text-[#d9c79d]" />
              </button>
              <div className={`flex min-w-0 items-center gap-3 ${isCollapsed ? "mx-auto" : ""}`}>
                <button onClick={() => setLocation("/")} className="group/icon grid h-14 w-14 shrink-0 place-items-center rounded-lg transition duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c79d] group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12" aria-label="العودة إلى لوحة المخزن" title="لوحة المخزن">
                  <img src={WAREHOUSE_APP_ICON} alt="أيقونة مخزن REVERSE TECH" className="h-10 w-10 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.22)] transition duration-200 group-hover/icon:-rotate-3 group-hover/icon:scale-110 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9" />
                </button>
                {!isCollapsed && <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-[.08em] text-white">نظام المخزن</p><span className="mt-1 block text-[9px] font-bold tracking-[.12em] text-[#ddc68e]">المخزون والطلبات</span></div>}
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="gap-0">
            <SidebarMenu className="gap-1 px-3 py-5">
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-md text-right font-medium text-[#c7d0cf] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#b58a4a] data-[active=true]:text-[#fffdf7]">
                    <item.icon className={`h-4 w-4 ${location === item.path ? "text-white" : ""}`} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="space-y-3 border-t border-white/10 p-3">
            <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-9 w-9 shrink-0 border border-white/10">
                <AvatarFallback className="bg-[#294c62] text-xs font-medium text-white">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium leading-none text-white">{user?.name || "-"}</p>
                <p className="mt-1.5 truncate text-xs text-slate-500">{user?.role === "admin" ? "مسؤول المخزن" : "مستخدم مساحة العمل"}</p>
              </div>
            </div>
            <button onClick={switchAccount} disabled={isSigningOut} aria-label="تسجيل الخروج وتبديل الحساب" title="تسجيل الخروج وتبديل الحساب" className="group flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#d0b27a] bg-[#a77b3d] px-3 text-sm font-bold text-white shadow-[0_5px_14px_rgba(0,0,0,.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#90672f] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c79d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17374c] disabled:cursor-wait disabled:opacity-75 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:px-0">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/15 ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-105">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="group-data-[collapsible=icon]:hidden">{isSigningOut ? "يتم تبديل الحساب…" : "تسجيل الخروج وتبديل الحساب"}</span>
            </button>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute left-0 top-0 z-50 h-full w-1 cursor-col-resize hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => !isCollapsed && setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-[#f4f0e8]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#d9d0bf] bg-[#fffefa]/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-md border border-[#d9d0bf] bg-[#fffefa] md:hidden" />
            <button onClick={() => setLocation("/")} className="group/icon grid h-9 w-9 place-items-center rounded-md transition hover:bg-[#f4f0e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b58a4a] md:hidden" aria-label="العودة إلى لوحة المخزن">
              <img src={WAREHOUSE_APP_ICON} alt="أيقونة المخزن" className="h-7 w-7 object-contain transition duration-200 group-hover/icon:-rotate-3 group-hover/icon:scale-110" />
            </button>
            <div>
              <p className="text-sm font-semibold text-[#18354a]">{activeMenuItem?.label ?? "مساحة العمل"}</p>
              <p className="text-[11px] text-[#777065]">تشغيل المخزون والطلبات الداخلي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#BEECDD] bg-[#E7F8F4] px-2.5 py-1 text-[11px] font-semibold text-[#008E7A] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00B39A]" />جلسة العمل نشطة
            </span>
            <button onClick={switchAccount} disabled={isSigningOut} aria-label="تسجيل الخروج وتبديل الحساب" title="تسجيل الخروج وتبديل الحساب" className="grid h-9 w-9 place-items-center rounded-lg border border-[#5FB6F2]/35 bg-[#0178D4] text-white shadow-[0_4px_12px_rgba(1,120,212,.2)] transition-all hover:-translate-y-0.5 hover:bg-[#0B70B5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0178D4] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-75 md:hidden">
              <LogOut className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#DCEAF7] bg-white text-[#0178D4] hover:text-[#0B2E4E]" aria-label="التنبيهات">
                  <BellRing className="h-4 w-4" />
                  {unreadAlerts.length > 0 && <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-[#FF7A29] px-1 text-[10px] font-bold leading-4 text-white">{unreadAlerts.length > 9 ? "+9" : unreadAlerts.length}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-[#E8EEF3] px-4 py-3">
                  <div><p className="font-bold text-[#0B2E4E]">{notificationTitle}</p><p className="mt-0.5 text-[11px] text-slate-500">{notificationDescription}</p></div>
                  <div className="flex items-center gap-2"><button type="button" onClick={toggleNotificationSound} className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${notificationSoundEnabled ? "border-[#8EDACD] bg-[#E7F8F4] text-[#008E7A]" : "border-[#DCEAF7] bg-white text-slate-400"}`} aria-label={notificationSoundEnabled ? "إيقاف صوت الإشعارات" : "تشغيل صوت الإشعارات"} title={notificationSoundEnabled ? "صوت الإشعارات مفعّل" : "صوت الإشعارات متوقف"}>{notificationSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><span className="text-xs text-slate-500">{unreadAlertLabel}</span></div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {alerts?.slice(0, 8).map(alert => (
                    <button key={alert.id} onClick={() => { if (!alert.isRead) markAlertRead.mutate({ id: alert.id }); if (alert.requestId) setLocation(requestRoute); }} className={`w-full border-b border-[#F1F5F9] px-4 py-3 text-right hover:bg-[#F7FBFF] ${alert.isRead ? "" : "bg-[#F1F8FE]"}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${alert.isRead ? "bg-slate-300" : "bg-[#0178D4]"}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#0B2E4E]">{alert.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isAdmin ? "bg-[#E7F3FE] text-[#0178D4]" : "bg-[#E7F8F4] text-[#008E7A]"}`}>{notificationCategory(alert.type, isAdmin)}</span></div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{alert.body}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!alerts?.length && <div className="p-7 text-center text-sm text-slate-500">لا توجد إشعارات مسجلة في هذه الجلسة.</div>}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
