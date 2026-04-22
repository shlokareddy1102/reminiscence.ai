import { useEffect, useState } from "react";
import { MapPin, Battery, Volume2, Wifi, Clock, Home } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const SELECTED_PATIENT_KEY = "caregiverSelectedPatientId";

const CaregiverLocation = () => {
  const [patients, setPatients] = useState([]);
  const [patientName, setPatientName] = useState("Patient");
  const [locationName, setLocationName] = useState("Loading...");
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [isSafe, setIsSafe] = useState(true);
  const [movements, setMovements] = useState([]);
  const [patientId, setPatientId] = useState(null);

  useEffect(() => {
    const loadLocation = async () => {
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

      const [teamLocations, activeSos] = await Promise.all([
        apiRequest(`/api/location/team/${patient._id}`),
        apiRequest(`/api/location/sos/active/${patient._id}`)
      ]);

      const patientLocation = (teamLocations || []).find((item) => item.role === "patient") || teamLocations?.[0];
      if (patientLocation) {
        const lat = patientLocation.coordinates?.latitude;
        const lon = patientLocation.coordinates?.longitude;
        setLocationName(lat && lon ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "Unknown");
        setLastUpdated(new Date(patientLocation.timestamp).toLocaleString());
      }

      const hasActiveSOS = Array.isArray(activeSos) && activeSos.length > 0;
      setIsSafe(!hasActiveSOS);

      const history = (teamLocations || []).slice(0, 5).map((entry) => ({
        time: new Date(entry.timestamp).toLocaleTimeString(),
        location: entry.coordinates
          ? `${entry.coordinates.latitude.toFixed(4)}, ${entry.coordinates.longitude.toFixed(4)}`
          : "Unknown",
        duration: "-"
      }));

      if (history.length) setMovements(history);
      } catch (_err) {
      // Keep graceful UI fallbacks.
      }
    };

    loadLocation();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    localStorage.setItem(SELECTED_PATIENT_KEY, patientId);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    const loadByPatient = async () => {
      try {
      const [patient, teamLocations, activeSos] = await Promise.all([
        apiRequest(`/api/patient/${patientId}`),
        apiRequest(`/api/location/team/${patientId}`),
        apiRequest(`/api/location/sos/active/${patientId}`)
      ]);

      setPatientName(patient?.name || "Patient");

      const patientLocation = (teamLocations || []).find((item) => item.role === "patient") || teamLocations?.[0];
      if (patientLocation) {
        const lat = patientLocation.coordinates?.latitude;
        const lon = patientLocation.coordinates?.longitude;
        setLocationName(lat && lon ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "Unknown");
        setLastUpdated(new Date(patientLocation.timestamp).toLocaleString());
      }

      const hasActiveSOS = Array.isArray(activeSos) && activeSos.length > 0;
      setIsSafe(!hasActiveSOS);

      const history = (teamLocations || []).slice(0, 5).map((entry) => ({
        time: new Date(entry.timestamp).toLocaleTimeString(),
        location: entry.coordinates
          ? `${entry.coordinates.latitude.toFixed(4)}, ${entry.coordinates.longitude.toFixed(4)}`
          : "Unknown",
        duration: "-"
      }));

      if (history.length) setMovements(history);
      } catch (_err) {
      // Keep previous state if patient reload fails.
      }
    };

    loadByPatient();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    const socket = getSocket();
    socket.emit("join-caregiver-room", patientId);

    const onLocationUpdated = (payload) => {
      const loc = payload?.location;
      if (!loc) return;

      if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      setLocationName(`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
      }
      setLastUpdated(new Date(loc.timestamp || Date.now()).toLocaleString());
      setMovements((prev) => [
      {
        time: new Date(loc.timestamp || Date.now()).toLocaleTimeString(),
        location:
          typeof loc.latitude === "number" && typeof loc.longitude === "number"
            ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
            : "Unknown",
        duration: "Current"
      },
      ...prev
      ].slice(0, 5));
    };

    const onSosTriggered = () => setIsSafe(false);
    const onSosResolved = () => setIsSafe(true);

    socket.on("locationUpdated", onLocationUpdated);
    socket.on("sosAlertTriggered", onSosTriggered);
    socket.on("sosAlertResolved", onSosResolved);

    return () => {
      socket.off("locationUpdated", onLocationUpdated);
      socket.off("sosAlertTriggered", onSosTriggered);
      socket.off("sosAlertResolved", onSosResolved);
    };
  }, [patientId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <MapPin className="w-8 h-8 text-primary" />
          Location Tracking
        </h1>
        <p className="text-muted-foreground mt-1">Real-time location and device status for {patientName}</p>
      </div>
      <div className="w-full sm:w-72">
        <label className="block text-xs text-muted-foreground mb-1">Selected patient</label>
        <select
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          value={patientId || ""}
          onChange={(e) => {
            localStorage.setItem(SELECTED_PATIENT_KEY, e.target.value);
            setPatientId(e.target.value);
          }}
        >
          {patients.map((patient) => (
            <option key={patient._id} value={patient._id}>{patient.name}</option>
          ))}
        </select>
      </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-gentle">
        <div className="relative h-80 md:h-96 bg-secondary/30">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse-gentle">
                  <Home className="w-10 h-10 text-primary" />
                </div>
                <p className="text-base sm:text-lg font-semibold text-foreground break-all px-2">{locationName}</p>
                <p className="text-sm text-muted-foreground mt-1">Last updated: {lastUpdated}</p>
            </div>
          </div>

          <div className="absolute inset-0 opacity-20">
            <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
                  backgroundSize: "50px 50px"
                }}
            />
          </div>

          <div
            className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                isSafe ? "bg-safe/90 text-safe-foreground" : "bg-alert/90 text-alert-foreground"
            }`}
          >
            <div
                className={`w-2 h-2 rounded-full animate-pulse-gentle ${
                  isSafe ? "bg-safe-foreground" : "bg-alert-foreground"
                }`}
            />
            {isSafe ? "Within Safe Zone" : "SOS Active"}
          </div>
        </div>

        <div className="p-6 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <p className="text-sm text-muted-foreground mb-1">Current Location</p>
                <p className="font-semibold text-foreground break-all">{locationName}</p>
                <p className="text-sm text-muted-foreground">Live location feed</p>
            </div>
            <div>
                <p className="text-sm text-muted-foreground mb-1">Time at Location</p>
                <p className="font-semibold text-foreground">2 hours 15 minutes</p>
            </div>
            <div>
                <p className="text-sm text-muted-foreground mb-1">Safe Zone Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSafe ? "bg-safe" : "bg-alert"}`} />
                  <p className={`font-semibold ${isSafe ? "text-safe" : "text-alert"}`}>
                    {isSafe ? "Inside Safe Zone" : "Emergency active"}
                  </p>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-gentle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-safe/10 flex items-center justify-center">
                <Battery className="w-6 h-6 text-safe" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Battery</p>
                <p className="text-xl font-bold text-foreground">78%</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-safe rounded-full" style={{ width: "78%" }} />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-gentle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-accent" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Phone Sound</p>
                <p className="text-xl font-bold text-foreground">Ringing</p>
            </div>
          </div>
          <button className="mt-4 w-full py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
            Toggle Sound
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-gentle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-safe/10 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-safe" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Connection</p>
                <p className="text-xl font-bold text-foreground">Online</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Last sync: 30 seconds ago
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-gentle">
        <h2 className="text-lg font-semibold text-foreground mb-4">Today's Movement</h2>
        <div className="space-y-3">
          {(movements.length
            ? movements
            : [
                  { time: "2:15 PM", location: "Living Room", duration: "Current" },
                  { time: "12:00 PM", location: "Kitchen", duration: "45 min" },
                  { time: "10:30 AM", location: "Bedroom", duration: "1h 30min" }
                ]).map((entry, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-16 text-sm text-muted-foreground">{entry.time}</div>
                <div className="w-3 h-3 rounded-full bg-primary/30 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{entry.location}</p>
                </div>
                <div className="text-sm text-muted-foreground">{entry.duration}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaregiverLocation;

