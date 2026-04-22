import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  MoreVertical,
  Pill,
  UserRound,
  ChevronRight
} from "lucide-react";
import PatientSwitcher from "@/components/caregiver/PatientSwitcher";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const SELECTED_PATIENT_KEY = "caregiverSelectedPatientId";

const normalizeSeverity = (riskLevel) =>
  riskLevel === "HIGH" ? "high" : riskLevel === "MEDIUM" ? "medium" : "low";

const toRelativeTime = (dateInput) => {
  if (!dateInput) return "just now";
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

const mapAlertCategory = (message = "") => {
  const text = String(message).toLowerCase();
  if (text.includes("med") || text.includes("pill")) return "Medication";
  if (text.includes("activity") || text.includes("movement")) return "Activity";
  if (text.includes("unknown") || text.includes("person")) return "Unknown Person";
  if (text.includes("location") || text.includes("lost")) return "Location";
  return "General";
};

const mapCardIcon = (category) => {
  if (category === "Medication") return Pill;
  if (category === "Activity") return Activity;
  if (category === "Unknown Person") return UserRound;
  return Bell;
};

const CaregiverAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientName, setPatientName] = useState("Patient");
  const [patientId, setPatientId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [eventResolvedIds, setEventResolvedIds] = useState(() => {
    try {
      const raw = localStorage.getItem("caregiverResolvedEvents");
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  });

  useEffect(() => {
    const loadAlerts = async () => {
      try {
      const patientList = await apiRequest("/api/patient/list");
      if (Array.isArray(patientList)) {
        setPatients(patientList);
      }

      const savedPatientId = localStorage.getItem(SELECTED_PATIENT_KEY);
      const savedPatient = Array.isArray(patientList)
        ? patientList.find((p) => p._id === savedPatientId)
        : null;

      const patient = savedPatient || (Array.isArray(patientList) && patientList.length
        ? patientList[0]
        : await apiRequest("/api/patient"));
      if (!patient?._id) return;

      localStorage.setItem(SELECTED_PATIENT_KEY, patient._id);
      setPatientId(patient._id);
      setPatientName(patient.name || "Patient");

      const [alertsRes, eventsRes] = await Promise.all([
        apiRequest(`/api/alerts?patientId=${patient._id}`),
        apiRequest(`/api/events?patientId=${patient._id}`)
      ]);

      const fromAlerts = (alertsRes || []).slice(0, 50).map((item) => ({
        id: item._id,
        source: "alert",
        eventKey: `alert-${item._id}`,
        category: mapAlertCategory(item.message),
        title: item.message,
        description: item.message || "Alert detected for this patient.",
        createdAt: item.timestamp || item.createdAt,
        timeLabel: toRelativeTime(item.timestamp || item.createdAt),
        severity: normalizeSeverity(item.riskLevel),
        riskLevel: item.riskLevel,
        acknowledged: Boolean(item.acknowledged)
      }));

      const fromEvents = (eventsRes || [])
        .filter((event) => event.eventType === "unknown_person_detected")
        .slice(0, 30)
        .map((event) => ({
        id: event._id,
        source: "event",
        eventKey: `event-${event._id}`,
        category: "Unknown Person",
        title: "Unknown person detected",
        description: "Unrecognized person detected near patient. Please review and identify.",
        createdAt: event.timestamp || event.createdAt,
        timeLabel: toRelativeTime(event.timestamp || event.createdAt),
        severity: normalizeSeverity(event.riskLevel),
        riskLevel: event.riskLevel,
        acknowledged: eventResolvedIds.includes(`event-${event._id}`)
      }));

      const merged = [...fromAlerts, ...fromEvents]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80);

      setAlerts(merged);
      } catch (_err) {
      setAlerts([]);
      }
    };

    loadAlerts();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    localStorage.setItem(SELECTED_PATIENT_KEY, patientId);
  }, [patientId]);

  useEffect(() => {
    localStorage.setItem("caregiverResolvedEvents", JSON.stringify(eventResolvedIds));
  }, [eventResolvedIds]);

  useEffect(() => {
    if (!patientId) return;

    const socket = getSocket();
    socket.emit("join-caregiver-room", patientId);

    const pushAlert = (next) => {
      setAlerts((prev) => [{ ...next, isNew: true }, ...prev].slice(0, 50));
    };

    const onAlertGenerated = (item) => {
      pushAlert({
      id: item._id || `live-${Date.now()}`,
      source: "alert",
      eventKey: item._id ? `alert-${item._id}` : `alert-live-${Date.now()}`,
      category: mapAlertCategory(item.message),
      title: item.message || "Alert",
      description: item.message || "New backend alert",
      createdAt: item.timestamp || Date.now(),
      timeLabel: toRelativeTime(item.timestamp || Date.now()),
      severity: normalizeSeverity(item.riskLevel),
      riskLevel: item.riskLevel,
      acknowledged: Boolean(item.acknowledged)
      });
    };

    const onUnknownDetected = (payload) => {
      pushAlert({
      id: payload?.event?._id || `unknown-${Date.now()}`,
      source: "event",
      eventKey: payload?.event?._id ? `event-${payload.event._id}` : `event-live-${Date.now()}`,
      category: "Unknown Person",
      title: "Unknown person detected",
      description: "A new unknown face was detected near the patient",
      createdAt: payload?.event?.timestamp || Date.now(),
      timeLabel: toRelativeTime(payload?.event?.timestamp || Date.now()),
      severity: normalizeSeverity(payload?.event?.riskLevel || "HIGH"),
      riskLevel: payload?.event?.riskLevel || "HIGH",
      acknowledged: false
      });
    };

    const onTaskMissed = (task) => {
      pushAlert({
      id: `task-${task._id || Date.now()}`,
      source: "event",
      eventKey: `event-task-${task._id || Date.now()}`,
      category: "Medication",
      title: "Task missed",
      description: `${task.title || "Task"} was missed`,
      createdAt: Date.now(),
      timeLabel: toRelativeTime(Date.now()),
      severity: "high",
      riskLevel: "HIGH",
      acknowledged: false
      });
    };

    socket.on("alertGenerated", onAlertGenerated);
    socket.on("unknownPersonDetected", onUnknownDetected);
    socket.on("taskMissed", onTaskMissed);

    return () => {
      socket.off("alertGenerated", onAlertGenerated);
      socket.off("unknownPersonDetected", onUnknownDetected);
      socket.off("taskMissed", onTaskMissed);
    };
  }, [patientId]);

  const acknowledgeItem = async (item) => {
    if (item.source === "alert" && item.id) {
      try {
        const updated = await apiRequest(`/api/alerts/${item.id}/acknowledge`, { method: "PUT" });
        setAlerts((prev) =>
          prev.map((entry) =>
            entry.eventKey === item.eventKey
              ? { ...entry, acknowledged: Boolean(updated?.acknowledged ?? true) }
              : entry
          )
        );
      } catch (_err) {
        // Keep existing state if backend call fails.
      }
      return;
    }

    if (item.source === "event") {
      setEventResolvedIds((prev) => (prev.includes(item.eventKey) ? prev : [...prev, item.eventKey]));
      setAlerts((prev) =>
        prev.map((entry) =>
          entry.eventKey === item.eventKey ? { ...entry, acknowledged: true } : entry
        )
      );
    }
  };

  const counts = alerts.reduce(
    (acc, a) => {
      if (a.severity === "high") acc.high++;
      else if (a.severity === "medium") acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const resolvedCount = alerts.filter((a) => a.acknowledged).length;

  const visibleAlerts = useMemo(() => {
    if (activeTab === "unread") return alerts.filter((a) => !a.acknowledged);
    if (activeTab === "resolved") return alerts.filter((a) => a.acknowledged);
    return alerts;
  }, [alerts, activeTab]);

  const tabBtnClass = (tab) =>
    `rounded-2xl px-6 py-3 text-sm font-medium transition-colors ${
      activeTab === tab
        ? "bg-card text-foreground shadow-sm border border-border"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const severityStripe = (severity) =>
    severity === "high" ? "border-l-[#e34b4b]" : severity === "medium" ? "border-l-[#e2a12e]" : "border-l-[#3aa76d]";

  const severityBadge = (severity) =>
    severity === "high"
      ? "bg-[#e34b4b] text-white"
      : severity === "medium"
        ? "bg-[#e2a12e] text-white"
        : "bg-[#3aa76d] text-white";

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">Live and historical alerts for {patientName}</p>
        </div>
        <div className="w-full sm:w-72">
          <PatientSwitcher patients={patients} value={patientId} onChange={setPatientId} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-alert/10 border border-alert/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-alert">{counts.high}</p>
          <p className="text-sm text-muted-foreground">High Priority</p>
        </div>
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-warning">{counts.medium}</p>
          <p className="text-sm text-muted-foreground">Medium Priority</p>
        </div>
        <div className="bg-safe/10 border border-safe/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-safe">{counts.low}</p>
          <p className="text-sm text-muted-foreground">Low Priority</p>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-2xl p-1.5 flex items-center gap-2 w-full max-w-[760px]">
        <button className={tabBtnClass("all")} onClick={() => setActiveTab("all")}>All Alerts</button>
        <button className={tabBtnClass("unread")} onClick={() => setActiveTab("unread")}>
          Unread <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-2 text-xs">{unreadCount}</span>
        </button>
        <button className={tabBtnClass("resolved")} onClick={() => setActiveTab("resolved")}>Resolved {resolvedCount > 0 ? `(${resolvedCount})` : ""}</button>
      </div>

      <div className="space-y-4">
        {visibleAlerts.map((alert) => {
          const Icon = mapCardIcon(alert.category);
          const isUrgent = alert.severity === "high";
          return (
          <div key={alert.eventKey} className={`rounded-3xl border border-border bg-card shadow-gentle overflow-hidden border-l-4 ${severityStripe(alert.severity)} ${alert.isNew ? "animate-fade-in" : ""}`}>
            <div className="p-6 flex items-start justify-between gap-4">
              <div className="flex gap-4 min-w-0">
                <div className="h-16 w-16 rounded-3xl bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon className="w-8 h-8 text-foreground/80" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-[40px] font-display font-semibold text-foreground leading-none">{alert.title}</h3>
                    {isUrgent && <span className={`px-3 py-1 rounded-xl text-sm font-semibold ${severityBadge(alert.severity)}`}>Urgent</span>}
                    {alert.acknowledged && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-safe/15 text-safe px-3 py-1 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Resolved
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[32px] leading-tight text-muted-foreground">{alert.description}</p>
                  <div className="mt-4 flex items-center gap-3 text-[26px] text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="w-5 h-5" /> {alert.timeLabel}</span>
                    <span className="rounded-xl bg-muted px-3 py-1 text-sm">{alert.category}</span>
                  </div>
                </div>
              </div>
              <button className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="border-t border-border px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[30px] text-muted-foreground">
                {alert.acknowledged ? "Already resolved" : isUrgent ? "Requires immediate attention" : "Review when convenient"}
              </p>
              <button
                onClick={() => acknowledgeItem(alert)}
                disabled={alert.acknowledged}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-lg font-semibold transition-colors ${
                  alert.acknowledged
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : isUrgent
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {alert.acknowledged ? "Resolved" : "Take Action"} <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );})}

        {visibleAlerts.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-foreground font-medium">No alerts in this view.</p>
            <p className="text-sm text-muted-foreground mt-1">Incoming unknown-person, medication and safety alerts will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaregiverAlerts;

