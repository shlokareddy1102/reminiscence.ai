import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import GameModuleHost from "@/components/games/GameModuleHost";
import { apiRequest } from "@/lib/api";
import { getPatientPreviewId } from "@/lib/auth";
import { gameModules } from "@/components/games/gameRegistry";

const GamePlayPage = () => {
  const { gameId } = useParams();
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

  const gameModule = useMemo(
    () => gameModules.find((item) => item.route === gameId || item.id === gameId),
    [gameId]
  );

  if (!gameModule) {
    return <Navigate to="/patient/games" replace />;
  }

  return (
    <PatientLayout>
      <div className="max-w-5xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient/games" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to games
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">{gameModule.label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{gameModule.description}</p>
        </section>

        <GameModuleHost module={gameModule} context={{ patientId }} />
      </div>
    </PatientLayout>
  );
};

export default GamePlayPage;
