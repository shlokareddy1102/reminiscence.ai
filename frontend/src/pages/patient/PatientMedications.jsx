import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Pill } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const meds = [
  { name: "Morning Medication", time: "09:00 AM", taken: true },
  { name: "Afternoon Medication", time: "02:00 PM", taken: false },
  { name: "Evening Medication", time: "08:00 PM", taken: false }
];

const PatientMedications = () => {
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">My Medications</h1>
          <p className="text-sm text-muted-foreground mt-1">Simple reminders for today.</p>
        </section>

        <section className="space-y-3">
          {meds.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover-lift">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.time}</p>
                </div>
              </div>
              <div className={`text-sm font-semibold ${item.taken ? "text-safe" : "text-warning"}`}>
                {item.taken ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Taken</span> : "Due"}
              </div>
            </div>
          ))}
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientMedications;
