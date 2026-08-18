import { useAuth } from "@/_core/hooks/useAuth";
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BellRing, Boxes, Building2, ClipboardList, FileText, History, LayoutDashboard, LogOut, Package, PanelLeft, Shapes, UsersRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Supply command", path: "/" },
  { icon: Boxes, label: "Components", path: "/inventory" },
  { icon: Shapes, label: "Component types", path: "/component-types" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ClipboardList, label: "Requests", path: "/requests" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: Building2, label: "Departments", path: "/departments" },
  { icon: UsersRound, label: "Employees", path: "/employees" },
  { icon: History, label: "Audit ledger", path: "/transactions" },
];

const engineerMenuItems = [
  { icon: LayoutDashboard, label: "My workspace", path: "/" },
  { icon: Boxes, label: "Components", path: "/inventory" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ClipboardList, label: "My requests", path: "/requests" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) return <SupabaseAuthScreen />;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function SupabaseAuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<"admin" | "user">("user");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name, requested_role: requestedRole }, emailRedirectTo: window.location.origin } });
    setSubmitting(false);
    if (result.error) { setMessage(result.error.message); return; }
    setMessage(mode === "signup" && !result.data.session ? "Check your email to confirm the new account, then sign in." : "Authentication successful. Loading your workspace…");
  };
  return <div className="min-h-screen bg-[#F4F9FD] grid place-items-center p-5"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#DCEAF7] bg-white shadow-[0_18px_50px_rgba(11,46,78,.12)]"><div className="bg-[#0B2E4E] p-7"><div className="inline-flex rounded-md bg-white p-2"><img src="/manus-storage/reverse-tech-logo_04d48f19.webp" alt="Reverse Tech" className="h-8 w-auto" /></div><p className="mt-5 text-[10px] font-bold tracking-[.18em] uppercase text-[#5FB6F2]">Analyze · Design · Manufacture</p><h1 className="mt-2 text-2xl font-extrabold text-white">{mode === "signin" ? "Sign in to supply control" : "Create your workspace account"}</h1><p className="mt-2 text-sm leading-6 text-[#CDE8FA]">Secure access for Reverse Tech warehouse operations.</p></div><form onSubmit={submit} className="p-7 space-y-4">{mode === "signup" && <><div className="space-y-2"><Label htmlFor="auth-name">Full name</Label><Input id="auth-name" value={name} onChange={event => setName(event.target.value)} required /></div><div className="space-y-2"><Label>Requested account role</Label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setRequestedRole("user")} className={`rounded-lg border p-3 text-left ${requestedRole === "user" ? "border-[#0178D4] bg-[#F1F8FE]" : "border-[#E8EEF3]"}`}><span className="block text-sm font-bold text-[#0B2E4E]">User</span><span className="text-[11px] text-slate-500">Search and request</span></button><button type="button" onClick={() => setRequestedRole("admin")} className={`rounded-lg border p-3 text-left ${requestedRole === "admin" ? "border-[#0178D4] bg-[#F1F8FE]" : "border-[#E8EEF3]"}`}><span className="block text-sm font-bold text-[#0B2E4E]">Admin</span><span className="text-[11px] text-slate-500">Full warehouse control</span></button></div><p className="text-xs leading-5 text-slate-500">Admin access is activated only for the first account or when an existing Admin assigns it in the employee directory.</p></div></>}<div className="space-y-2"><Label htmlFor="auth-email">Email address</Label><Input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" minLength={6} value={password} onChange={event => setPassword(event.target.value)} required /></div>{message && <p className="rounded-lg border border-[#B9DAF7] bg-[#F1F8FE] px-3 py-2 text-sm text-[#0B5798]">{message}</p>}<Button type="submit" disabled={submitting || !hasSupabaseConfiguration} className="w-full bg-[#0178D4] hover:bg-[#0065B3] text-white">{submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button><p className="text-center text-sm text-slate-500">{mode === "signin" ? "New to Reverse Tech?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="font-semibold text-[#0178D4] hover:underline">{mode === "signin" ? "Create account" : "Sign in"}</button></p></form></div></div>;
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = user?.role === "admin" ? adminMenuItems : engineerMenuItems;
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: alerts } = trpc.warehouse.alerts.list.useQuery();
  const markAlertRead = trpc.warehouse.alerts.markRead.useMutation({ onSuccess: () => utils.warehouse.alerts.list.invalidate() });
  const unreadAlerts = alerts?.filter(alert => !alert.isRead) ?? [];

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-[#0B2E4E] text-slate-200"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-20 justify-center border-b border-white/10">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0"
                aria-label="Toggle navigation"
              >
                  <PanelLeft className="h-4 w-4 text-slate-400" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0"><div className="rounded-md bg-white px-2 py-1"><img src="/manus-storage/reverse-tech-logo_04d48f19.webp" alt="Reverse Tech" className="h-5 w-auto object-contain" /></div><span className="mt-1 text-[9px] tracking-[0.14em] text-[#9ECDF2] uppercase block">Supply & inventory</span></div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-3 py-5 gap-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-medium text-slate-400 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-[#5FB6F2]" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/10 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                  <Avatar className="h-9 w-9 border border-white/10 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-slate-800 text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-white">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1.5 capitalize">
                      {user?.role === "admin" ? "Reverse Tech admin" : "Engineering user"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-[#F4F9FD]">
        <header className="flex border-b border-[#DCEAF7] h-16 items-center justify-between bg-white/85 px-4 sm:px-7 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-3"><SidebarTrigger className={`h-9 w-9 rounded-lg bg-white border border-[#DCEAF7] ${isMobile ? "" : "hidden"}`} /><div><p className="text-sm font-semibold text-[#0B2E4E]">{activeMenuItem?.label ?? "Workspace"}</p><p className="text-[11px] text-slate-500">REVERSE TECH supply operations</p></div></div>
          <div className="flex items-center gap-2"><span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#BEECDD] bg-[#E7F8F4] px-2.5 py-1 text-[11px] font-semibold text-[#008E7A]"><span className="h-1.5 w-1.5 rounded-full bg-[#00B39A]" />System active</span><DropdownMenu><DropdownMenuTrigger asChild><button className="relative h-9 w-9 rounded-lg border border-[#DCEAF7] bg-white grid place-items-center text-[#0178D4] hover:text-[#0B2E4E]" aria-label="Notifications"><BellRing className="h-4 w-4" />{unreadAlerts.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-[#FF7A29] text-[10px] leading-4 font-bold text-white">{unreadAlerts.length > 9 ? "9+" : unreadAlerts.length}</span>}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0 overflow-hidden"><div className="px-4 py-3 border-b border-[#E8EEF3] flex items-center justify-between"><p className="font-bold text-[#0B2E4E]">Notifications</p><span className="text-xs text-slate-500">{unreadAlerts.length} unread</span></div><div className="max-h-96 overflow-y-auto">{alerts?.slice(0, 8).map(alert => <button key={alert.id} onClick={() => { if (!alert.isRead) markAlertRead.mutate({ id: alert.id }); if (alert.requestId) setLocation("/requests"); }} className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F7FBFF] ${alert.isRead ? "" : "bg-[#F1F8FE]"}`}><div className="flex items-start gap-2"><span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${alert.isRead ? "bg-slate-300" : "bg-[#0178D4]"}`} /><div><p className="text-sm font-semibold text-[#0B2E4E]">{alert.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{alert.body}</p></div></div></button>)}{!alerts?.length && <div className="p-7 text-center text-sm text-slate-500">No notifications yet.</div>}</div></DropdownMenuContent></DropdownMenu></div>
        </header>
        <main className="flex-1 p-4 sm:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
