import { useEffect, useState } from "react";
import { Download, FileText, Pill, Dumbbell, Camera, Share2 } from "lucide-react";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import { API_BASE_URL, apiRequest } from "@/lib/api";

const CaregiverReports = () => {
  const { patients, selectedPatientId, selectedPatient, setPatient } = useCaregiverPatients();
  const [stats, setStats] = useState(null);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedPatientId) return;

    const load = async () => {
      setLoading(true);
      try {
      const [statsRes, logsRes, activityRes, reportsRes] = await Promise.all([
        apiRequest(`/api/reports/patient-stats/${selectedPatientId}?days=30`),
        apiRequest(`/api/reports/daily-log/${selectedPatientId}?days=90`),
        apiRequest(`/api/activity?patientId=${selectedPatientId}`),
        apiRequest(`/api/reports/history/${selectedPatientId}`)
      ]);

      setStats(statsRes || null);
      setDailyLogs(Array.isArray(logsRes) ? logsRes : []);
      setActivityLogs(Array.isArray(activityRes) ? activityRes : []);
      setReportHistory(Array.isArray(reportsRes) ? reportsRes : []);
      } catch (_err) {
      setStats(null);
      setDailyLogs([]);
      setActivityLogs([]);
      setReportHistory([]);
      } finally {
      setLoading(false);
      }
    };

    load();
  }, [selectedPatientId]);

  const onExport = async () => {
    if (!selectedPatientId) return;
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/reports/generate`, {
      method: "POST",
      headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ patientId: selectedPatientId, reportType: "weekly" })
    });

    if (!response.ok) return;
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedPatient?.name || "patient"}-weekly-report.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const latestReport = reportHistory.length ? reportHistory[0] : null;
  const latestModel = latestReport?.mlAssessment || null;
  const modelSourceLabel = latestModel?.source ? String(latestModel.source).toUpperCase() : "N/A";

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">AI reports, daily logs, medication and exercise adherence for {selectedPatient?.name || "selected patient"}.</p>
      </div>
      <div className="w-full lg:w-72">
        <PatientSwitcher patients={patients} value={selectedPatientId} onChange={setPatient} />
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="bg-card border border-border rounded-xl p-4 hover-lift">
        <p className="text-xs text-muted-foreground">Medication Adherence</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats?.medicationAdherencePercent || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">Missed days: {stats?.totals?.missedMedicationDays || 0}</p>
          <Pill className="w-5 h-5 text-primary mt-3" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <p className="text-xs text-muted-foreground">Exercise Tracking</p>
          <p className="text-2xl font-bold text-foreground mt-1">{Math.max(0, 14 - (stats?.totals?.lowActivityDays || 0))}/14</p>
          <p className="text-xs text-muted-foreground mt-1">Active days in 2 weeks</p>
          <Dumbbell className="w-5 h-5 text-safe mt-3" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <p className="text-xs text-muted-foreground">CV Exercise Session</p>
          <p className="text-lg font-semibold text-foreground mt-1">Camera Ready</p>
          <p className="text-xs text-muted-foreground mt-1">Placeholder for computer vision exercise session status</p>
          <Camera className="w-5 h-5 text-accent mt-3" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <p className="text-xs text-muted-foreground">Doctor Share</p>
          <button onClick={onExport} className="mt-2 w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium">Export Weekly PDF</button>
          <button className="mt-2 w-full rounded-lg border border-input py-2 text-sm font-medium text-foreground">Share Doctor View</button>
          <Share2 className="w-5 h-5 text-primary mt-3" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold">Daily Health Logs</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          ) : dailyLogs.length ? (
            <div className="space-y-2 max-h-72 overflow-auto">
                {dailyLogs.slice().reverse().map((log) => (
                  <div key={log._id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{new Date(log.date).toLocaleDateString()}</p>
                    <p className="text-muted-foreground">Mood: {log.mood} | Sleep: {log.sleep} | Medication: {log.medication} | Food: {log.food} | Activity: {log.activity}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No logs for this patient yet.</p>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold">AI Report History</h2>
          </div>
          {reportHistory.length ? (
            <div className="space-y-2 max-h-72 overflow-auto">
                {reportHistory.map((report) => (
                  <div key={report._id || `${report.reportType}-${report.generatedAt}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{report.reportType.toUpperCase()} report</p>
                    <p className="text-muted-foreground">{new Date(report.generatedAt).toLocaleString()} | Trend: {report.riskTrend}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold">Patient Activity Log</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : activityLogs.length ? (
            <div className="space-y-2 max-h-72 overflow-auto">
              {activityLogs.map((item) => (
                <div key={item._id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{item.interactionType}</p>
                  <p className="text-muted-foreground">{new Date(item.timestamp || item.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity logs found for this patient.</p>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold">Latest Model Output</h2>
          </div>
          {latestModel ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground"><span className="font-medium">Source:</span> {modelSourceLabel}</p>
              <p className="text-foreground"><span className="font-medium">Risk Score:</span> {latestModel.riskScore ?? "N/A"}</p>
              <p className="text-foreground"><span className="font-medium">Risk Level:</span> {latestModel.riskLevel || "N/A"}</p>
              <p className="text-foreground"><span className="font-medium">Anomaly Flag:</span> {latestModel?.anomaly?.isAnomaly ? "Yes" : "No"}</p>
              <p className="text-foreground"><span className="font-medium">Anomaly Score:</span> {latestModel?.anomaly?.anomalyScore ?? "N/A"}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No model output recorded yet. Submit a daily log to generate ML assessment metadata.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default CaregiverReports;

