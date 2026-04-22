import { Link } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const memories = [
  { id: "1", title: "Family Picnic", date: "June 2024" },
  { id: "2", title: "Birthday Celebration", date: "January 2025" },
  { id: "3", title: "Beach Visit", date: "August 2025" }
];

const PatientMemories = () => {
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Memories</h1>
          <p className="text-sm text-muted-foreground mt-1">Photos and moments to revisit when you want.</p>
        </section>

        <section className="grid sm:grid-cols-2 gap-3">
          {memories.map((memory) => (
            <div key={memory.id} className="rounded-2xl border border-border bg-card p-4 hover-lift">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 glow-pulse">
                <Camera className="w-5 h-5" />
              </div>
              <p className="font-semibold text-foreground">{memory.title}</p>
              <p className="text-sm text-muted-foreground">{memory.date}</p>
            </div>
          ))}
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientMemories;
