import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Heart, Clock3, ImagePlus } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const memories = [
  {
    id: "1",
    title: "Family Picnic",
    date: "June 2024",
    note: "Smiles by the lake with everyone together.",
  },
  {
    id: "2",
    title: "Birthday Celebration",
    date: "January 2025",
    note: "Cake, music, and a room full of laughter.",
  },
  {
    id: "3",
    title: "Beach Visit",
    date: "August 2025",
    note: "Sunny walk and seashells by the shore.",
  },
  {
    id: "4",
    title: "Garden Morning",
    date: "March 2026",
    note: "Flowers blooming and tea in the sunlight.",
  },
];

const PatientMemories = () => {
  return (
    <PatientLayout>
      <div className="max-w-6xl mx-auto w-full space-y-5 pb-8">
        <Link
          to="/patient"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Memory Gallery
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Revisit familiar moments in a calm, comforting space.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity"
            >
              <ImagePlus className="w-4 h-4" />
              Add memory
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-2xl border border-border bg-card p-4 hover-lift"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-3">
                <Camera className="w-5 h-5" />
              </div>

              <p className="font-semibold text-foreground text-base">{memory.title}</p>

              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="w-3.5 h-3.5" />
                <span>{memory.date}</span>
              </div>

              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {memory.note}
              </p>

              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Heart className="w-4 h-4" />
                View memory
              </button>
            </article>
          ))}
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientMemories;
