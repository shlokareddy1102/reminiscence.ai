import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Brain, FileText, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";

const CaregiverInsights = () => {
  const { patients, selectedPatient, selectedPatientId, setPatient } = useCaregiverPatients();
  const [cohortInsight, setCohortInsight] = useState("");
  const [statsByPatient, setStatsByPatient] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [medicalComparison, setMedicalComparison] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
      const normalized = Array.isArray(patients) ? patients : [];

      const insightRes = await apiRequest("/api/reports/ai-cohort-insights");
      setCohortInsight(insightRes?.insight || "");

      const stats = await Promise.all(
        normalized.map(async (patient) => {
          const stat = await apiRequest(`/api/reports/patient-stats/${patient._id}?days=30`);
          return {
            patientId: patient._id,
            patientName: patient.name,
            poorSleepDays: stat?.totals?.poorSleepDays || 0,
            agitatedDays: stat?.totals?.agitatedDays || 0,
            lowActivityDays: stat?.totals?.lowActivityDays || 0,
            adherence: stat?.medicationAdherencePercent || 0
          };
        })
      );

      setStatsByPatient(stats);
      } catch (_err) {
      setStatsByPatient([]);
      }
    };

    load();
  }, [patients]);

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadComparison = async () => {
      try {
        const [result, medical] = await Promise.all([
          apiRequest(`/api/reports/comparison-intelligence/${selectedPatientId}?currentDays=7&previousDays=7&cohortDays=30`),
          apiRequest(`/api/reports/medical-report-comparison/${selectedPatientId}?days=60`)
        ]);
        setComparison(result || null);
        setMedicalComparison(medical || null);
      } catch (_err) {
        setComparison(null);
        setMedicalComparison(null);
      }
    };

    loadComparison();
  }, [selectedPatientId]);

  // Pattern-level language avoids negative patient-vs-patient framing.
  const patternCards = useMemo(() => {
    if (!statsByPatient.length) return [];

    const withPoorSleep = statsByPatient.filter((p) => p.poorSleepDays >= 4).length;
    const withAgitation = statsByPatient.filter((p) => p.agitatedDays >= 4).length;
    const withLowActivity = statsByPatient.filter((p) => p.lowActivityDays >= 4).length;

    return [
      {
      title: "Sleep & Agitation Pattern",
      text: `${withPoorSleep} patients show repeated poor sleep and ${withAgitation} show higher agitation in the same period.`
      },
      {
      title: "Activity Pattern",
      text: `${withLowActivity} patients show lower activity days; schedule short guided movement blocks.`
      },
      {
      title: "Cohort AI Insight",
      text: cohortInsight || "Collect more logs to improve cohort-level pattern confidence."
      }
    ];
  }, [statsByPatient, cohortInsight]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Insights & Comparison</h1>
        <p className="text-sm text-muted-foreground">Pattern-based multi-patient insights for proactive dementia care planning.</p>
        </div>
        <div className="w-full lg:w-80">
          <PatientSwitcher patients={patients} value={selectedPatientId} onChange={setPatient} />
        </div>
      </div>

      {comparison && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-base font-display font-semibold text-foreground">Your Trend</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{comparison?.selfComparison?.summary}</p>
            <div className="space-y-1.5">
              {(comparison?.selfComparison?.metrics || []).map((metric) => (
                <p key={metric.metric} className="text-xs text-foreground">
                  {metric.metric}: {metric.direction === "improving" ? "up" : metric.direction === "declining" ? "down" : "stable"}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="text-base font-display font-semibold text-foreground">Similar Patients Insight</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {comparison?.crossPatientComparison?.insight}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Similar cohort size: {comparison?.crossPatientComparison?.similarPatientCount || 0}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="text-base font-display font-semibold text-foreground">Combined Intelligence</h2>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {comparison?.combinedIntelligence?.message}
            </p>
            <div className="mt-3 space-y-1.5">
              {(comparison?.crossPatientComparison?.recommendedActions || []).slice(0, 2).map((action, idx) => (
                <p key={`action-${idx}`} className="text-xs text-muted-foreground">- {action}</p>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Patient: {selectedPatient?.name || "Selected patient"}
            </p>
          </div>
        </section>
      )}

      {medicalComparison && (
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Medical Report Comparison</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{medicalComparison.insight}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Declining Trend</p>
              <p className="text-foreground font-semibold mt-1">
                Patient {medicalComparison?.patient?.decliningPercent || 0}% vs Cohort {medicalComparison?.cohort?.decliningPercent || 0}%
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Average Risk Score</p>
              <p className="text-foreground font-semibold mt-1">
                Patient {medicalComparison?.patient?.avgRiskScore || 0} vs Cohort {medicalComparison?.cohort?.avgRiskScore || 0}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">High-Risk Alerts / Report</p>
              <p className="text-foreground font-semibold mt-1">
                Patient {medicalComparison?.patient?.avgHighRiskAlerts || 0} vs Cohort {medicalComparison?.cohort?.avgHighRiskAlerts || 0}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Recommendation: {medicalComparison.recommendation}</p>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {patternCards.map((card) => (
          <div key={card.title} className="bg-card border border-border rounded-xl p-4 hover-lift">
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.text}</p>
          </div>
        ))}
      </div>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold">30-Day Trend Snapshot</h2>
        </div>
        <div className="space-y-3">
          {statsByPatient.map((item) => (
            <div key={item.patientId} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground mb-2">{item.patientName}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <p>Medication adherence: {item.adherence}%</p>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-safe" style={{ width: `${item.adherence}%` }} />
                  </div>
                </div>
                <div>
                  <p>Poor sleep days: {item.poorSleepDays}</p>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-warning" style={{ width: `${Math.min(100, item.poorSleepDays * 8)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-semibold">Comparison Policy</h2>
        </div>
        <p className="text-sm text-muted-foreground">Comparisons are pattern-oriented and supportive. This view does not rank patients or label one patient as better/worse.</p>
      </div>
    </div>
  );
};

export default CaregiverInsights;

