import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getPatientPreviewId } from "@/lib/auth";
import GameModuleHost from "@/components/games/GameModuleHost";
import { defaultGameRoute, gameModules } from "@/components/games/gameRegistry";

const tabClass = ({ isActive }) =>
  `rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-primary text-primary-foreground border-primary"
      : "border-border bg-card text-foreground hover:bg-muted/50"
  }`;

const GamesDashboard = () => {
  const [patientId, setPatientId] = useState(null);

  useEffect(() => {
    const loadPatient = async () => {
      try {
        const previewId = getPatientPreviewId();
        const patient = await apiRequest(previewId ? `/api/patient/${previewId}` : "/api/patient");
        setPatientId(patient?._id || null);
      } catch (_err) {
        setPatientId(null);
      }
    };

    loadPatient();
  }, []);

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Brain Games</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simple, calm games for memory, recognition, and cognitive reinforcement.
          </p>
        </section>

        <section className="grid sm:grid-cols-3 gap-2">
          {gameModules.map((game) => {
            const Icon = game.icon;
            const to = `/patient/games/${game.route}`;
            return (
              <NavLink key={game.id} to={to} className={tabClass}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{game.label}</span>
                </div>
              </NavLink>
            );
          })}
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          {gameModules.map((game) => {
            const to = `/patient/games/${game.route}`;
            return (
            <Link key={`${game.id}-card`} to={to} className="rounded-2xl border border-border bg-card p-4 hover-lift">
              <p className="font-semibold text-foreground">{game.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{game.description}</p>
            </Link>
          );
          })}
        </section>

        <Routes>
          {gameModules.map((game) => (
            <Route
              key={game.id}
              path={game.route}
              element={<GameModuleHost module={game} context={{ patientId }} />}
            />
          ))}
          <Route path="*" element={<Navigate to={`/patient/games/${defaultGameRoute}`} replace />} />
        </Routes>
      </div>
    </PatientLayout>
  );
};

export default GamesDashboard;
