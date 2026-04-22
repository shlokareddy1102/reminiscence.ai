import { ReactNode, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Bell,
  Heart,
  Menu,
  X,
  LogOut,
  Settings,
  Phone
} from "lucide-react";
import { logout } from "@/lib/auth";
import { disconnectSocket } from "@/lib/socket";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/caregiver", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "/caregiver/alerts", label: "Alerts", icon: Bell, end: false },
  { path: "/caregiver/patients", label: "Patients", icon: Users, end: false },
  { path: "/caregiver/reports", label: "Reports", icon: FileText, end: false },
  { path: "/caregiver/insights", label: "Insights", icon: BarChart3, end: false },
  { path: "/caregiver/contacts", label: "Contacts", icon: Phone, end: false }
];

function SidebarPatientList() {
  const { patients, selectedPatientId, setPatient, loadingPatients } = useCaregiverPatients();

  if (loadingPatients && patients.length === 0) {
    return (
      <div className="space-y-2 px-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-sidebar-accent/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!patients.length) {
    return <p className="text-xs text-muted-foreground px-1 py-2">Add patients in the Patients area.</p>;
  }

  return (
    <ScrollArea className="h-[min(42vh,320px)] pr-2">
      <ul className="space-y-1.5">
        {patients.map((p) => {
          const active = p._id === selectedPatientId;
          const initial = (p.name || "?").slice(0, 1).toUpperCase();
          return (
            <li key={p._id}>
              <button
                type="button"
                onClick={() => setPatient(p._id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                  "hover:bg-sidebar-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active &&
                    "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-transform",
                    active ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
                  )}
                >
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name || "Patient"}</span>
                  <span className={cn("block truncate text-[11px]", active ? "text-white/80" : "text-muted-foreground")}>
                    Care workspace
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

export default function CaregiverLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate("/", { replace: true });
  };

  const NavBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25 transition-transform hover:scale-105 duration-200">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground tracking-tight">Reminiscence</h1>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Caregiver</p>
          </div>
        </div>
      </div>

      <nav className="p-3 border-b border-sidebar-border">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Navigate</p>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-0.5"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 p-3 flex flex-col min-h-0">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Active patient
        </p>
        <SidebarPatientList />
        <p className="mt-3 px-3 text-[10px] leading-snug text-muted-foreground">
          Selecting a patient updates Dashboard, Reports, and alert context.
        </p>
      </div>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/caregiver/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
            location.pathname.startsWith("/caregiver/settings") && "bg-sidebar-accent font-medium"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:border-transparent"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="caregiver-container min-h-screen flex bg-muted/30">
      <aside className="hidden lg:flex lg:w-72 xl:w-80 flex-col border-r border-sidebar-border bg-sidebar shadow-[4px_0_24px_-12px_rgba(0,0,0,0.08)]">
        <NavBody />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Reminiscence</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-transform active:scale-95"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="max-h-[min(85vh,640px)] overflow-y-auto border-t border-border bg-sidebar p-3 animate-fade-in">
            <NavBody onNavigate={() => setMobileOpen(false)} />
          </div>
        )}
      </div>

      <main className="flex-1 min-w-0 pt-[4.25rem] lg:pt-0">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
