import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { apiRequest, API_BASE_URL } from "./lib/api";
import { getCurrentUser, hasRole, isAuthenticated } from "./lib/auth";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PatientHome from "./pages/patient/PatientHome";
import PatientFamily from "./pages/patient/PatientFamily";
import PatientMedications from "./pages/patient/PatientMedications";
import PatientMyDay from "./pages/patient/PatientMyDay";
import PatientMemories from "./pages/patient/PatientMemories";
import CaregiverDashboard from "./pages/caregiver/CaregiverDashboard";
import CaregiverAlerts from "./pages/caregiver/CaregiverAlerts";
import CaregiverLocation from "./pages/caregiver/CaregiverLocation";
import CaregiverContacts from "./pages/caregiver/CaregiverContacts";
import CaregiverReports from "./pages/caregiver/CaregiverReports";
import CaregiverInsights from "./pages/caregiver/CaregiverInsights";
import CaregiverPatients from "./pages/caregiver/CaregiverPatients";
import CaregiverSettings from "./pages/caregiver/CaregiverSettings";
import CaregiverShell from "./components/caregiver/CaregiverShell";

const queryClient = new QueryClient();

const PatientRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  if (!hasRole("patient")) return <Navigate to="/caregiver" replace />;
  return children;
};

const CaregiverRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  if (!hasRole("caregiver")) return <Navigate to="/patient" replace />;
  return children;
};

const SessionTracker = () => {
  const location = useLocation();
  const sessionIdRef = useRef(null);

  useEffect(() => {
    const getClientId = () => {
      const existing = localStorage.getItem("clientId");
      if (existing) return existing;

      const generated = `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("clientId", generated);
      return generated;
    };

    const startSession = async () => {
      try {
        const user = getCurrentUser();
        const data = await apiRequest("/api/analytics/session/start", {
          method: "POST",
          body: JSON.stringify({
            clientId: getClientId(),
            userId: user?.id || null,
            role: user?.role || "guest",
            pagePath: location.pathname
          })
        });

        sessionIdRef.current = data?.sessionId || null;
      } catch (_err) {
        // Ignore analytics errors so auth/navigation is unaffected.
      }
    };

    startSession();

    const endSession = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      const payload = JSON.stringify({ sessionId });
      navigator.sendBeacon?.(`${API_BASE_URL}/api/analytics/session/end-beacon`, new Blob([payload], { type: "application/json" }));
    };

    window.addEventListener("pagehide", endSession);
    window.addEventListener("beforeunload", endSession);

    return () => {
      window.removeEventListener("pagehide", endSession);
      window.removeEventListener("beforeunload", endSession);
      endSession();
    };
  }, [location.pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionTracker />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/patient" element={<PatientRoute><PatientHome /></PatientRoute>} />
          <Route path="/patient/family" element={<PatientRoute><PatientFamily /></PatientRoute>} />
          <Route path="/patient/medications" element={<PatientRoute><PatientMedications /></PatientRoute>} />
          <Route path="/patient/day" element={<PatientRoute><PatientMyDay /></PatientRoute>} />
          <Route path="/patient/memories" element={<PatientRoute><PatientMemories /></PatientRoute>} />
          <Route
            path="/caregiver"
            element={
              <CaregiverRoute>
                <CaregiverShell />
              </CaregiverRoute>
            }
          >
            <Route index element={<CaregiverDashboard />} />
            <Route path="patients" element={<CaregiverPatients />} />
            <Route path="reports" element={<CaregiverReports />} />
            <Route path="insights" element={<CaregiverInsights />} />
            <Route path="alerts" element={<CaregiverAlerts />} />
            <Route path="settings" element={<CaregiverSettings />} />
            <Route path="location" element={<CaregiverLocation />} />
            <Route path="contacts" element={<CaregiverContacts />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
