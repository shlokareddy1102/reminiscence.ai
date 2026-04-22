import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  MapPin,
  Pill,
  X,
  Plus,
  UserPlus
} from "lucide-react";
import KnownPeopleManager from "@/components/caregiver/KnownPeopleManager";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";
import HealthStatCard from "@/components/caregiver/dashboard/HealthStatCard";
import TrendBars from "@/components/caregiver/dashboard/TrendBars";
import { useCaregiverPatients } from "@/hooks/use-caregiver-patients";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { toast } from "@/hooks/use-toast";

const alertToneClass = {
  high: "border-alert/30 bg-alert/10",
  medium: "border-warning/30 bg-warning/10",
  low: "border-safe/30 bg-safe/10"
};

const mapAlerts = (alerts = []) =>
  alerts.map((item) => ({
    id: item._id,
    title: item.message,
    time: new Date(item.timestamp || item.createdAt).toLocaleString(),
    severity: item.riskLevel === "HIGH" ? "high" : item.riskLevel === "MEDIUM" ? "medium" : "low"
  }));

const scoreSleep = (sleep) => (sleep === "good" ? 90 : sleep === "disturbed" ? 55 : 25);
const scoreMood = (mood) => (mood === "calm" ? 90 : mood === "confused" ? 55 : 25);
const scoreActivity = (activity) => (activity === "high" ? 90 : activity === "medium" ? 60 : activity === "low" ? 30 : 20);
const scoreLocationSafety = ({ gotLost, highRiskAlerts }) => {
  if (gotLost) return 25;
  if (highRiskAlerts >= 2) return 45;
  return 90;
};

const formatRelativeVisit = (dateInput) => {
  if (!dateInput) return "Not visited yet";
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
};

const CaregiverDashboard = () => {
  const { patients, selectedPatient, selectedPatientId, setPatient } = useCaregiverPatients();

  const [isSwitching, setIsSwitching] = useState(false);
  const [showKnownPeople, setShowKnownPeople] = useState(false);
  const [unknownPersonAlert, setUnknownPersonAlert] = useState(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState({ name: "", relationship: "" });
  const [formErrors, setFormErrors] = useState({});

  const [recentAlerts, setRecentAlerts] = useState([]);
  const [alertRecords, setAlertRecords] = useState([]);
  const [knownPeople, setKnownPeople] = useState([]);
  const [patientStats, setPatientStats] = useState(null);
  const [patientPatterns, setPatientPatterns] = useState([]);
  const [patientPatternRecommendation, setPatientPatternRecommendation] = useState("");
  const [patientLogs, setPatientLogs] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);

  const [dailyLog, setDailyLog] = useState({
    mood: "calm",
    sleep: "good",
    confusionLevel: "none",
    gotLost: false
  });
  const [logSubmitting, setLogSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadPatientScopedData = async () => {
      setIsSwitching(true);
      try {
      const [alerts, stats, patterns, logs, people] = await Promise.all([
        apiRequest(`/api/alerts?patientId=${selectedPatientId}`),
        apiRequest(`/api/reports/patient-stats/${selectedPatientId}?days=30`),
        apiRequest(`/api/reports/patient-patterns/${selectedPatientId}?days=30`),
        apiRequest(`/api/reports/daily-log/${selectedPatientId}?days=14`),
        apiRequest(`/api/known-people?patientId=${selectedPatientId}`)
      ]);

      setAlertRecords(Array.isArray(alerts) ? alerts : []);
      setRecentAlerts(mapAlerts(Array.isArray(alerts) ? alerts.slice(0, 6) : []));
      setKnownPeople(Array.isArray(people) ? people : []);
      setPatientStats(stats || null);
      setPatientPatterns(Array.isArray(patterns?.patterns) ? patterns.patterns : []);
      setPatientPatternRecommendation(String(patterns?.recommendation || ""));
      setPatientLogs(Array.isArray(logs) ? logs : []);
      } catch (_err) {
      setRecentAlerts([]);
      setAlertRecords([]);
      setKnownPeople([]);
      } finally {
      setIsSwitching(false);
      }
    };

    loadPatientScopedData();
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) return;

    const socket = getSocket();
    socket.emit("join-caregiver-room", selectedPatientId);

    const onAlertGenerated = (item) => {
      setRecentAlerts((prev) => [
      {
        id: item._id || `live-${Date.now()}`,
        title: item.message || "Alert",
        time: new Date(item.timestamp || Date.now()).toLocaleString(),
        severity: item.riskLevel === "HIGH" ? "high" : item.riskLevel === "MEDIUM" ? "medium" : "low"
      },
      ...prev
      ].slice(0, 6));
    };

    const onUnknownPersonDetected = (data) => {
      setUnknownPersonAlert(data);
      toast({
        title: "Unknown Person Detected",
        description: "A person was detected that isn't in the known people list. Would you like to add them?",
        variant: "default"
      });
    };

    socket.on("alertGenerated", onAlertGenerated);
    socket.on("unknownPersonDetected", onUnknownPersonDetected);
    return () => {
      socket.off("alertGenerated", onAlertGenerated);
      socket.off("unknownPersonDetected", onUnknownPersonDetected);
    };
  }, [selectedPatientId]);

  const latestLog = patientLogs.length ? patientLogs[patientLogs.length - 1] : null;

  const medicationAdherence = patientStats?.medicationAdherencePercent || 0;
  const highRiskAlerts = patientStats?.totals?.highRiskAlerts || 0;
  const locationSafetyScore = scoreLocationSafety({ gotLost: Boolean(latestLog?.gotLost), highRiskAlerts });
  const activityScore = latestLog ? scoreActivity(latestLog.activity) : 0;

  const medicationTone = medicationAdherence >= 80 ? "good" : medicationAdherence >= 50 ? "warning" : "critical";
  const locationTone = locationSafetyScore >= 75 ? "good" : locationSafetyScore >= 45 ? "warning" : "critical";
  const activityTone = activityScore >= 75 ? "good" : activityScore >= 45 ? "warning" : "critical";

  const trendData = useMemo(() => {
    const recent = patientLogs.slice(-7);
    return {
      medication: recent.map((log) => (log.medication === "taken" ? 100 : log.medication === "missed" ? 25 : 45)),
      mood: recent.map((log) => scoreMood(log.mood)),
      sleep: recent.map((log) => scoreSleep(log.sleep))
    };
  }, [patientLogs]);

  const weeklySummary = useMemo(() => {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentVisitors = knownPeople.filter((person) => {
      if (!person?.lastVisitedTime) return false;
      return new Date(person.lastVisitedTime).getTime() >= weekAgo;
    }).length;

    const alertsResolved = alertRecords.filter((alert) => alert.acknowledged).length;

    return {
      visitors: recentVisitors,
      locationSafety: locationSafetyScore,
      medication: medicationAdherence,
      alertsResolved
    };
  }, [knownPeople, alertRecords, locationSafetyScore, medicationAdherence]);

  const aiHighlights = useMemo(() => {
    if (!dailyReport?.insights?.length) {
      if (patientPatterns.length) {
      return patientPatterns.slice(0, 3).map((p) => `${p.key}: ${p.count} days`);
      }
      return ["Add daily logs to generate sharper AI highlights."];
    }
    return dailyReport.insights.slice(0, 3);
  }, [dailyReport, patientPatterns]);

  const submitDailyLog = async () => {
    if (!selectedPatientId) return;
    setLogSubmitting(true);
    try {
      const data = await apiRequest("/api/reports/daily-log", {
      method: "POST",
      body: JSON.stringify({
        patientId: selectedPatientId,
        ...dailyLog
      })
      });

      setDailyReport(data?.report || null);
      setPatientLogs((prev) => [
      ...prev.filter((p) => p?._id !== data?.log?._id),
      data?.log
      ]);

      toast({
      title: "Daily log saved",
      description: "AI report generated for selected patient."
      });
    } catch (err) {
      toast({
      title: "Could not save daily log",
      description: err.message || "Please try again",
      variant: "destructive"
      });
    } finally {
      setLogSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-gentle">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Care Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Focused health overview for {selectedPatient?.name || "selected patient"}</p>
        </div>
        <div className="w-full xl:w-72">
          <PatientSwitcher patients={patients} value={selectedPatientId} onChange={setPatient} />
        </div>
      </div>

        {recentAlerts.some((a) => a.severity === "high") && (
          <div className="mt-4 rounded-xl border border-alert/30 bg-alert/10 p-3 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-alert mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-alert">Critical Alert</p>
                    <p className="text-xs text-foreground">{recentAlerts.find((a) => a.severity === "high")?.title}</p>
                  </div>
                </div>
                <Link to="/caregiver/alerts" className="text-xs font-medium text-alert hover:underline">Take Action</Link>
            </div>
          </div>
        )}
      </header>

      <section className={`transition-all duration-300 ${isSwitching ? "opacity-55" : "opacity-100"}`}>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-4 min-w-max">
            <div className="w-[260px] shrink-0">
              <HealthStatCard title="Medication adherence" value={`${medicationAdherence}%`} hint="Last 30 days" icon={Pill} tone={medicationTone} />
            </div>
            <div className="w-[260px] shrink-0">
              <HealthStatCard
                title="Location safety"
                value={`${locationSafetyScore}%`}
                hint={latestLog?.gotLost ? "Lost incident reported" : "No lost incident reported"}
                icon={MapPin}
                tone={locationTone}
              />
            </div>
            <div className="w-[260px] shrink-0">
              <HealthStatCard title="High-risk alerts" value={`${highRiskAlerts}`} hint="Last 30 days" icon={AlertTriangle} tone={highRiskAlerts >= 3 ? "critical" : highRiskAlerts >= 1 ? "warning" : "good"} />
            </div>
            <div className="w-[260px] shrink-0">
              <HealthStatCard title="Activity level" value={`${activityScore}%`} hint={latestLog ? `Latest: ${latestLog.activity}` : "No data"} icon={Activity} tone={activityTone} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-[1.05fr_1.95fr] gap-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-gentle">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Known People</h2>
              <p className="text-sm text-muted-foreground">Recognized visitors</p>
            </div>
            <button
              type="button"
              onClick={() => setShowKnownPeople(true)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Manage
            </button>
          </div>

          <div className="space-y-4">
            {(knownPeople.slice(0, 3)).map((person) => {
              const initials = String(person.name || "?")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={person._id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground font-semibold truncate">{person.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{person.relationship}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">{formatRelativeVisit(person.lastVisitedTime)}</p>
                </div>
              );
            })}

            {knownPeople.length === 0 && (
              <p className="text-sm text-muted-foreground">No recognized visitors yet.</p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-gentle">
          <h2 className="text-2xl font-display font-bold text-foreground">This Week's Summary</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Key metrics and insights</p>

          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max">
              <div className="w-[190px] rounded-3xl border border-border bg-muted/35 p-5">
                <p className="text-5xl font-display font-bold text-foreground leading-none">{weeklySummary.visitors}</p>
                <p className="text-sm text-muted-foreground mt-3">Visitor Count</p>
              </div>

              <div className="w-[190px] rounded-3xl border border-border bg-muted/35 p-5">
                <p className="text-5xl font-display font-bold text-foreground leading-none">{weeklySummary.locationSafety}%</p>
                <p className="text-sm text-muted-foreground mt-3">Location Safety</p>
              </div>

              <div className="w-[190px] rounded-3xl border border-border bg-muted/35 p-5">
                <p className="text-5xl font-display font-bold text-foreground leading-none">{weeklySummary.medication}%</p>
                <p className="text-sm text-muted-foreground mt-3">Med. Adherence</p>
              </div>

              <div className="w-[190px] rounded-3xl border border-border bg-muted/35 p-5">
                <p className="text-5xl font-display font-bold text-foreground leading-none">{weeklySummary.alertsResolved}</p>
                <p className="text-sm text-muted-foreground mt-3">Alerts Resolved</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">Daily Caregiver Log</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select className="rounded-lg border border-input bg-background px-2 py-2 text-sm" value={dailyLog.mood} onChange={(e) => setDailyLog((prev) => ({ ...prev, mood: e.target.value }))}>
                <option value="calm">Mood: Calm</option>
                <option value="confused">Mood: Confused</option>
                <option value="agitated">Mood: Agitated</option>
            </select>
            <select className="rounded-lg border border-input bg-background px-2 py-2 text-sm" value={dailyLog.sleep} onChange={(e) => setDailyLog((prev) => ({ ...prev, sleep: e.target.value }))}>
                <option value="good">Sleep: Good</option>
                <option value="disturbed">Sleep: Disturbed</option>
                <option value="poor">Sleep: Poor</option>
            </select>
            <select className="rounded-lg border border-input bg-background px-2 py-2 text-sm" value={dailyLog.confusionLevel} onChange={(e) => setDailyLog((prev) => ({ ...prev, confusionLevel: e.target.value }))}>
                <option value="none">Confusion: None</option>
                <option value="mild">Confusion: Mild</option>
                <option value="moderate">Confusion: Moderate</option>
                <option value="severe">Confusion: Severe</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <input type="checkbox" checked={dailyLog.gotLost} onChange={(e) => setDailyLog((prev) => ({ ...prev, gotLost: e.target.checked }))} />
                Lost incident today
            </label>
          </div>

          <button type="button" onClick={submitDailyLog} disabled={logSubmitting || !selectedPatientId} className="mt-3 w-full sm:w-auto rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {logSubmitting ? "Generating..." : "Save Log + Generate AI Report"}
          </button>

          <button onClick={() => setShowKnownPeople((prev) => !prev)} className="mt-3 w-full rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-between">
            <span>Known People Manager</span>
            {showKnownPeople ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showKnownPeople && (
            <div className="mt-3 animate-fade-in">
                <KnownPeopleManager patientId={selectedPatientId} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-display font-semibold text-foreground">Alerts</h2>
                <Link to="/caregiver/alerts" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
                {recentAlerts.length ? (
                  recentAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className={`rounded-lg border p-3 text-sm animate-fade-in ${alertToneClass[alert.severity]}`}>
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No active alerts for this patient.</p>
                )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
            <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-primary" />
                <h2 className="text-base font-display font-semibold text-foreground">AI Insights</h2>
            </div>
            <div className="space-y-2">
                {aiHighlights.map((item, idx) => (
                  <div key={`insight-${idx}`} className="rounded-lg bg-muted/45 px-3 py-2 text-sm text-foreground">
                    {item}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
          <h2 className="text-base font-display font-semibold text-foreground mb-3">Trends</h2>
          <div className="grid grid-cols-1 gap-3">
            <TrendBars title="Medication adherence trend" data={trendData.medication} colorClass="bg-safe" />
            <TrendBars title="Mood trend" data={trendData.mood} colorClass="bg-primary" />
            <TrendBars title="Sleep trend" data={trendData.sleep} colorClass="bg-warning" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
            <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-primary" />
                <h2 className="text-base font-display font-semibold text-foreground">Patient Patterns</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {patientPatterns.length ? (
                  patientPatterns.slice(0, 4).map((pattern) => (
                    <div key={pattern.key} className="rounded-lg border border-border p-3 text-sm hover-lift">
                      <p className="font-medium text-foreground">{pattern.key}</p>
                      <p className="text-xs text-muted-foreground mt-1">{pattern.count} days</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No strong patterns yet.</p>
                )}
            </div>
            {patientPatternRecommendation && (
                <p className="text-xs text-muted-foreground mt-3">Recommendation: {patientPatternRecommendation}</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-gentle">
            <h2 className="text-base font-display font-semibold text-foreground mb-2">More Sections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Link to="/caregiver/reports" className="rounded-lg border border-input px-3 py-2 hover:bg-muted transition-colors text-center">Reports</Link>
                <Link to="/caregiver/insights" className="rounded-lg border border-input px-3 py-2 hover:bg-muted transition-colors text-center">Insights</Link>
                <div className="rounded-lg border border-input px-3 py-2 text-center flex items-center justify-center gap-1 text-foreground">
                  <Dumbbell className="w-4 h-4" /> Exercise tracking
                </div>
            </div>
          </div>
        </div>
      </section>

      {unknownPersonAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl font-display font-bold text-foreground">Unknown Person Detected</h3>
              <button
                onClick={() => {
                  setUnknownPersonAlert(null);
                  setShowAddPersonModal(false);
                  setNewPersonForm({ name: "", relationship: "" });
                  setFormErrors({});
                }}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {unknownPersonAlert?.faceImage && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img 
                    src={unknownPersonAlert.faceImage} 
                    alt="Unknown person" 
                    className="w-full h-auto max-h-64 object-contain bg-muted"
                  />
                </div>
              )}

              {!showAddPersonModal ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    A person was detected that's not in the known people list. Would you like to add them to {selectedPatient?.name}'s family or known contacts?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setUnknownPersonAlert(null)}
                      className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => setShowAddPersonModal(true)}
                      className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Person
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Person's Name</label>
                    <input
                      type="text"
                      value={newPersonForm.name}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, name: e.target.value })}
                      placeholder="e.g., Jane Smith"
                      className={`w-full px-3 py-2 rounded-lg border ${formErrors.name ? "border-red-500" : "border-border"} bg-background`}
                    />
                    {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Relationship</label>
                    <input
                      type="text"
                      value={newPersonForm.relationship}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, relationship: e.target.value })}
                      placeholder="e.g., Daughter, Friend, Nurse"
                      className={`w-full px-3 py-2 rounded-lg border ${formErrors.relationship ? "border-red-500" : "border-border"} bg-background`}
                    />
                    {formErrors.relationship && <p className="text-xs text-red-500 mt-1">{formErrors.relationship}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAddPersonModal(false);
                        setNewPersonForm({ name: "", relationship: "" });
                        setFormErrors({});
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={async () => {
                        const errors = {};
                        if (!newPersonForm.name.trim()) errors.name = "Name is required";
                        if (!newPersonForm.relationship.trim()) errors.relationship = "Relationship is required";
                        
                        if (Object.keys(errors).length > 0) {
                          setFormErrors(errors);
                          return;
                        }

                        try {
                          await apiRequest('/api/known-people/add-from-detection', {
                            method: 'POST',
                            body: JSON.stringify({
                              patientId: selectedPatientId,
                              name: newPersonForm.name,
                              relationship: newPersonForm.relationship,
                              faceImage: unknownPersonAlert?.faceImage
                            })
                          });

                          toast({
                            title: "Person Added",
                            description: `${newPersonForm.name} has been added to known people for ${selectedPatient?.name}.`
                          });

                          setUnknownPersonAlert(null);
                          setShowAddPersonModal(false);
                          setNewPersonForm({ name: "", relationship: "" });
                          setFormErrors({});
                        } catch (err) {
                          toast({
                            title: "Error",
                            description: "Failed to add person to known people",
                            variant: "destructive"
                          });
                        }
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Known People
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaregiverDashboard;

