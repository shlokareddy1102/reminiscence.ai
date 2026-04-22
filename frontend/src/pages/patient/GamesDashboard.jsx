import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";
import { gameModules } from "@/components/games/gameRegistry";

const GamesDashboard = () => {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Brain Games</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap any game to open it in a focused full page.
          </p>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          {gameModules.map((game) => {
            const to = `/patient/games/play/${game.route}`;
            const Icon = game.icon;
            return (
              <Link key={`${game.id}-card`} to={to} className="rounded-2xl border border-border bg-card p-4 hover-lift">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <p className="font-semibold text-foreground">{game.label}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{game.description}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </PatientLayout>
  );
};

export default GamesDashboard;
