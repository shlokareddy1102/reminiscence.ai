import { useMemo } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";

const CaregiverPatients = () => {
  const navigate = useNavigate();
  const { patients, selectedPatientId, setPatient } = useCaregiverPatients();

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [patients]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Patients</h1>
        <p className="text-sm text-muted-foreground">Select a patient to load dashboard, alerts, logs, reports, and activity context.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sortedPatients.map((patient) => {
          const isSelected = patient._id === selectedPatientId;
          return (
            <article key={patient._id} className={`rounded-xl border p-4 bg-card hover-lift ${isSelected ? "border-primary shadow-calm" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {patient.name?.[0] || <UserRound className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{patient.name || "Unnamed patient"}</p>
                    <p className="text-xs text-muted-foreground">ID: {patient._id.slice(-6)}</p>
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full ${isSelected ? "bg-safe/10 text-safe" : "bg-muted text-muted-foreground"}`}>
                  {isSelected ? "Selected" : "Available"}
                </span>
              </div>

              <button
                onClick={() => {
                  setPatient(patient._id);
                  navigate("/caregiver");
                }}
                className="mt-3 w-full rounded-lg border border-input py-2 text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-2"
              >
                Open patient workspace
                <ArrowRight className="w-4 h-4" />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default CaregiverPatients;
