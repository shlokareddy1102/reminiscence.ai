import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Home } from "lucide-react";
import { logout } from "@/lib/auth";

interface PatientLayoutProps {
  children: ReactNode;
}

const PatientLayout = ({ children }: PatientLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="patient-container h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <span className="font-display font-bold text-primary text-lg">R</span>
            </div>
            <h1 className="font-display font-bold text-lg sm:text-xl text-foreground">Reminiscence</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/patient")}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Go to home"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full min-h-0 px-3 py-4 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default PatientLayout;
