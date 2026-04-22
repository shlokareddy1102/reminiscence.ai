import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const timeline = [
  { time: "09:00 AM", title: "Morning medication", done: true },
  { time: "11:30 AM", title: "Tea break", done: true },
  { time: "02:00 PM", title: "Doctor call", done: false },
  { time: "05:30 PM", title: "Walk with caregiver", done: false }
];

const PatientMyDay = () => {
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">My Day</h1>
          <p className="text-sm text-muted-foreground mt-1">Today&apos;s schedule in simple steps.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="space-y-3">
            {timeline.map((item) => (
              <div key={`${item.time}-${item.title}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <div className="w-16 text-xs sm:text-sm text-muted-foreground">{item.time}</div>
                <CalendarClock className={`w-4 h-4 ${item.done ? "text-safe" : "text-warning"}`} />
                <p className="font-medium text-foreground">{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientMyDay;
