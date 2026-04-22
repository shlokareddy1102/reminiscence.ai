import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Home, ArrowLeft, Users, Pill, CalendarDays, Image, Music2, Gamepad2, MoonStar } from "lucide-react";
import { clearPatientPreview, isPatientPreviewEnabled, logout } from "@/lib/auth";

interface PatientLayoutProps {
  children: ReactNode;
}

const PatientLayout = ({ children }: PatientLayoutProps) => {
  const navigate = useNavigate();

  const navItems = [
    { to: "/patient", label: "Dashboard", icon: Home },
    { to: "/patient/family", label: "Family", icon: Users },
    { to: "/patient/medications", label: "Medications", icon: Pill },
    { to: "/patient/day", label: "My Day", icon: CalendarDays },
    { to: "/patient/memories", label: "Memories", icon: Image },
    { to: "/patient/music", label: "Music Therapy", icon: Music2 },
    { to: "/patient/night-check-in", label: "Night Check-In", icon: MoonStar },
    { to: "/patient/games", label: "Games", icon: Gamepad2 },
  ];

  const handleLogout = () => {
    clearPatientPreview();
    logout();
    navigate("/", { replace: true });
  };

  const handleReturnToCaregiver = () => {
    clearPatientPreview();
    navigate("/caregiver", { replace: true });
  };

  return (
    <div className="patient-shell patient-container h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <span className="font-display font-bold text-primary text-lg">R</span>
            </div>
            <h1 className="font-display font-bold text-lg sm:text-xl text-foreground">Reminiscence</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {isPatientPreviewEnabled() && (
              <button
                onClick={handleReturnToCaregiver}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Return to caregiver dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to caregiver</span>
              </button>
            )}

            <button
              onClick={() => navigate("/patient")}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Go to home"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 w-full">
        <aside className="hidden md:flex md:w-56 lg:w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border border-primary/30"
                        : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-border/70 space-y-2">
            {isPatientPreviewEnabled() && (
              <button
                onClick={handleReturnToCaregiver}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                title="Return to caregiver dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to caregiver</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col w-full min-h-0 px-4 md:px-5 lg:px-6 py-4 overflow-y-auto text-[0.98rem] sm:text-base">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PatientLayout;
