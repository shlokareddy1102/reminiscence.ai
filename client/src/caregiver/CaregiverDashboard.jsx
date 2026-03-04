import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL, api } from '../lib/api';

const CaregiverDashboard = () => {
  const [patient, setPatient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [knownPeople, setKnownPeople] = useState([]);
  const [recognizedFeed, setRecognizedFeed] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: '',
    type: 'medication',
    scheduledTime: ''
  });
  const [personForm, setPersonForm] = useState({
    name: '',
    relationship: '',
    notes: '',
    photo: null
  });

  const fetchAll = async () => {
    const patientRes = await api.get('/api/patient');
    const patientData = patientRes.data;
    setPatient(patientData);

    const [tasksRes, alertsRes, eventsRes, activityRes, knownPeopleRes] = await Promise.all([
      api.get('/api/tasks', { params: { patientId: patientData._id } }),
      api.get('/api/alerts', { params: { patientId: patientData._id } }),
      api.get('/api/events', { params: { patientId: patientData._id } }),
      api.get('/api/activity', { params: { patientId: patientData._id } }),
      api.get('/api/known-people', { params: { patientId: patientData._id } })
    ]);

    setTasks(tasksRes.data);
    setAlerts(alertsRes.data);
    setEvents(eventsRes.data);
    setActivityLogs(activityRes.data);
    setKnownPeople(knownPeopleRes.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!patient?._id) return undefined;

    const socket = io(API_BASE_URL);
    socket.emit('join-caregiver-room', patient._id);

    socket.on('taskMissed', (task) => setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t))));
    socket.on('taskCompleted', (task) => setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t))));
    socket.on('taskCreated', (task) => setTasks((prev) => [...prev, task]));
    socket.on('activityLogged', (log) => setActivityLogs((prev) => [log, ...prev].slice(0, 100)));
    socket.on('eventCreated', (event) => setEvents((prev) => [event, ...prev].slice(0, 50)));
    socket.on('knownPersonAdded', (person) => setKnownPeople((prev) => [...prev, person]));
    socket.on('knownPersonSeen', (person) => {
      setKnownPeople((prev) => prev.map((p) => (p._id === person._id ? person : p)));
      setRecognizedFeed((prev) => [person, ...prev].slice(0, 20));
    });
    socket.on('alertGenerated', (alert) => setAlerts((prev) => [alert, ...prev].slice(0, 50)));
    socket.on('riskUpdated', ({ riskScore, currentState }) => {
      setPatient((prev) => (prev ? { ...prev, riskScore, currentState } : prev));
    });
    socket.on('stateChanged', ({ currentState }) => {
      setPatient((prev) => (prev ? { ...prev, currentState } : prev));
    });

    return () => socket.disconnect();
  }, [patient?._id]);

  const pendingCount = useMemo(() => tasks.filter((task) => task.status === 'pending').length, [tasks]);

  const acknowledge = async (alertId) => {
    const res = await api.put(`/api/alerts/${alertId}/acknowledge`);
    setAlerts((prev) => prev.map((alert) => (alert._id === alertId ? res.data : alert)));
  };

  const scheduleTask = async (e) => {
    e.preventDefault();
    if (!patient?._id) return;

    const payload = {
      patientId: patient._id,
      title: taskForm.title,
      type: taskForm.type,
      scheduledTime: taskForm.scheduledTime
    };

    const res = await api.post('/api/tasks', payload);
    setTasks((prev) => [...prev, res.data]);
    setTaskForm({ title: '', type: 'medication', scheduledTime: '' });
  };

  const addKnownPerson = async (e) => {
    e.preventDefault();
    if (!patient?._id || !personForm.photo) return;

    const formData = new FormData();
    formData.append('patientId', patient._id);
    formData.append('name', personForm.name);
    formData.append('relationship', personForm.relationship);
    formData.append('notes', personForm.notes);
    formData.append('photo', personForm.photo);

    const res = await api.post('/api/known-people', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setKnownPeople((prev) => [...prev, res.data]);
    setPersonForm({ name: '', relationship: '', notes: '', photo: null });
  };

  const removeKnownPerson = async (id) => {
    await api.delete(`/api/known-people/${id}`);
    setKnownPeople((prev) => prev.filter((person) => person._id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-emerald-50 p-6 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur">
          <h1 className="text-3xl font-bold">Caregiver Dashboard</h1>
          <p className="mt-2 text-slate-500">Monitor wellbeing, schedule reminders, and track recognized visitors in real time.</p>
        </div>

        {patient && (
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Patient</p>
              <p className="text-xl font-semibold">{patient.name}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Risk Score</p>
              <p className="text-2xl font-bold">{patient.riskScore}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Current State</p>
              <p className="text-xl font-semibold">{patient.currentState}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Pending Tasks</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-semibold">Schedule Task</h2>
            <form className="mt-4 space-y-3" onSubmit={scheduleTask}>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={taskForm.type}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="medication">Medication</option>
                <option value="appointment">Appointment</option>
                <option value="meal">Meal</option>
              </select>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={taskForm.scheduledTime}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                required
              />
              <button className="w-full rounded-lg bg-slate-800 py-2 text-white" type="submit">
                Add Task
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-semibold">Add Known Person</h2>
            <form className="mt-4 space-y-3" onSubmit={addKnownPerson}>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Name"
                value={personForm.name}
                onChange={(e) => setPersonForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Relationship"
                value={personForm.relationship}
                onChange={(e) => setPersonForm((prev) => ({ ...prev, relationship: e.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Notes"
                value={personForm.notes}
                onChange={(e) => setPersonForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                onChange={(e) => setPersonForm((prev) => ({ ...prev, photo: e.target.files?.[0] || null }))}
                required
              />
              <button className="w-full rounded-lg bg-emerald-600 py-2 text-white" type="submit">
                Upload Person
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-semibold">Task List</h2>
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <div key={task._id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-slate-500">{task.type} • {new Date(task.scheduledTime).toLocaleString()}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide">{task.status}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-semibold">Alert Feed</h2>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div key={alert._id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm text-slate-500">{new Date(alert.timestamp).toLocaleString()}</p>
                  {!alert.acknowledged && (
                    <button
                      className="mt-2 rounded-lg bg-slate-800 px-3 py-1 text-sm text-white"
                      onClick={() => acknowledge(alert._id)}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-semibold">Recent Events</h2>
            <div className="mt-4 space-y-3">
              {events.map((event) => (
                <div key={event._id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-medium">{event.eventType}</p>
                  <p className="text-sm text-slate-500">{event.category} • {event.riskLevel}</p>
                  <p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Known People</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {knownPeople.map((person) => (
              <div key={person._id} className="rounded-xl border border-slate-200 p-3">
                <img src={person.photo} alt={person.name} className="h-36 w-full rounded-lg object-cover" />
                <p className="mt-2 font-semibold">{person.name}</p>
                <p className="text-sm text-slate-500">{person.relationship}</p>
                <p className="text-xs text-slate-500">Last visited: {person.lastVisitedTime ? new Date(person.lastVisitedTime).toLocaleString() : 'Never'}</p>
                <p className="text-xs text-slate-500">Visits: {person.visitCount}</p>
                <button
                  className="mt-2 rounded-lg bg-rose-500 px-3 py-1 text-sm text-white"
                  onClick={() => removeKnownPerson(person._id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activityLogs.map((log) => (
              <div key={log._id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium">{log.interactionType}</p>
                <p className="text-sm text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Recognition Feed</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recognizedFeed.map((person) => (
              <div key={`${person._id}-${person.lastVisitedTime || person.updatedAt}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-medium">{person.name}</p>
                <p className="text-sm text-slate-600">{person.relationship}</p>
                <p className="text-xs text-slate-500">Recognized at {person.lastVisitedTime ? new Date(person.lastVisitedTime).toLocaleString() : 'Unknown'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CaregiverDashboard;
