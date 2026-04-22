import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Camera, Heart, MapPin, Phone, Pill } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import TimeDisplay from "@/components/patient/TimeDisplay";
import LocationCard from "@/components/patient/LocationCard";
import TaskList from "@/components/patient/TaskList";
import VoicePrompt from "@/components/patient/VoicePrompt";
import PatientPersonRecognition from "@/components/patient/PatientPersonRecognition";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const initialTasks = [
  { id: "1", title: "Schedule a meeting with a doctor", completed: false, scheduledTime: null },
  { id: "2", title: "Do groceries", completed: false, scheduledTime: null },
  { id: "3", title: "Take afternoon medication", completed: true, scheduledTime: null }
];

const PatientHome = () => {
  const [tasks, setTasks] = useState(initialTasks);
  const [patientName, setPatientName] = useState("Josh");
  const [locationLabel, setLocationLabel] = useState("Home");
  const [patientId, setPatientId] = useState(null);
  const [assistantMessage, setAssistantMessage] = useState("You are at home and safe. Your next appointment is at 2:30 PM today.");
  const notifiedTaskIdsRef = useRef(new Set());

  const speakMessage = (message) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleTask = async (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );

    try {
      await apiRequest(`/api/tasks/${id}/complete`, { method: "PUT" });
    } catch (_err) {
      // UI remains optimistic even if API call fails.
    }
  };

  useEffect(() => {
    const loadPatientData = async () => {
      try {
        const patient = await apiRequest("/api/patient");
        if (patient?.name) setPatientName(patient.name);
        if (patient?._id) setPatientId(patient._id);

        if (patient?._id) {
          const [taskList, teamLocations] = await Promise.all([
            apiRequest(`/api/tasks?patientId=${patient._id}`),
            apiRequest(`/api/location/team/${patient._id}`).catch(() => [])
          ]);

          if (Array.isArray(taskList) && taskList.length) {
            setTasks(
              taskList.slice(0, 8).map((item) => ({
                id: item._id,
                title: item.title,
                completed: item.status === "completed",
                scheduledTime: item.scheduledTime || null
              }))
            );
          }

          const pLoc = Array.isArray(teamLocations)
            ? teamLocations.find((entry) => entry.role === "patient")
            : null;

          if (pLoc?.coordinates) {
            setLocationLabel(
              `${pLoc.coordinates.latitude.toFixed(4)}, ${pLoc.coordinates.longitude.toFixed(4)}`
            );
          }
        }
      } catch (_err) {
        // Keep demo fallback values if backend is unavailable.
      }
    };

    loadPatientData();
  }, []);

  useEffect(() => {
    if (!patientId) return;

    const socket = getSocket();
    socket.emit("join-patient-room", patientId);

    const onTaskCreated = (task) => {
      setTasks((prev) => [{ id: task._id, title: task.title, completed: false, scheduledTime: task.scheduledTime || null }, ...prev].slice(0, 8));
      setAssistantMessage(`New task added: ${task.title}`);
    };

    const onTaskCompleted = (task) => {
      setTasks((prev) => prev.map((item) => (item.id === task._id ? { ...item, completed: true } : item)));
      setAssistantMessage(`Great job. Completed: ${task.title}`);
    };

    const onLocationUpdated = (payload) => {
      const loc = payload?.location;
      if (payload?.role === "patient" && loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        setLocationLabel(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
      }
    };

    const onSosAcknowledged = () => {
      setAssistantMessage("Your support request was acknowledged. Help is on the way.");
    };

    socket.on("taskCreated", onTaskCreated);
    socket.on("taskCompleted", onTaskCompleted);
    socket.on("locationUpdated", onLocationUpdated);
    socket.on("sosAlertAcknowledged", onSosAcknowledged);

    return () => {
      socket.off("taskCreated", onTaskCreated);
      socket.off("taskCompleted", onTaskCompleted);
      socket.off("locationUpdated", onLocationUpdated);
      socket.off("sosAlertAcknowledged", onSosAcknowledged);
    };
  }, [patientId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const dueTask = tasks.find((task) => {
        if (task.completed || !task.scheduledTime) return false;
        if (notifiedTaskIdsRef.current.has(task.id)) return false;
        return new Date(task.scheduledTime).getTime() <= now;
      });

      if (!dueTask) return;

      notifiedTaskIdsRef.current.add(dueTask.id);
      const reminderMessage = `Reminder: ${dueTask.title} is due now.`;
      setAssistantMessage(reminderMessage);
      speakMessage(reminderMessage);
    }, 10000);

    return () => clearInterval(interval);
  }, [tasks]);

  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full space-y-4 pb-6">
        <section className="glass rounded-3xl p-5 sm:p-6 hover-lift">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-1">
            Hi, {patientName}
          </h1>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">You are safe and supported. Let us take today one step at a time.</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 breathe">
            <span className="wave">🕒</span>
            <TimeDisplay />
          </div>
        </section>

        <section className="glass rounded-3xl p-4 sm:p-5 hover-lift">
          <h2 className="text-lg font-display font-semibold mb-3">Who is this person?</h2>
          <PatientPersonRecognition
            patientId={patientId}
            onAnnouncement={(message) => setAssistantMessage(message)}
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link to="/patient/family" className="min-h-14 rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover-lift">
            <Phone className="w-5 h-5 text-primary" />
            <span className="font-semibold">Call Family</span>
          </Link>
          <Link to="/patient/medications" className="min-h-14 rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover-lift">
            <Pill className="w-5 h-5 text-accent" />
            <span className="font-semibold">Medications</span>
          </Link>
          <Link to="/patient/day" className="min-h-14 rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover-lift">
            <CalendarDays className="w-5 h-5 text-safe" />
            <span className="font-semibold">My Day</span>
          </Link>
          <Link to="/patient/memories" className="min-h-14 rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover-lift">
            <Camera className="w-5 h-5 text-warning" />
            <span className="font-semibold">Memories</span>
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-3">
          <TaskList tasks={tasks} onToggle={handleToggleTask} />
          <LocationCard location={locationLabel} isSafe={true} />
          <VoicePrompt
            message={assistantMessage}
            isAiGenerated={true}
          />
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Need Help?
          </h2>
          <p className="text-sm text-foreground mt-1 leading-relaxed">If you feel worried, tap below and your caregiver team will be notified calmly.</p>
          <button className="mt-3 w-full min-h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95 transition-opacity">
            Contact Care Team
          </button>
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientHome;
