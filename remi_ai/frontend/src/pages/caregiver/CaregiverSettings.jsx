import { Bell, Shield, SlidersHorizontal } from "lucide-react";

const CaregiverSettings = () => {
  return (
    <div className="space-y-5">
      <div>
      <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">Configure alerts, privacy, and caregiver preferences.</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <Bell className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold text-foreground">Alert Preferences</p>
          <p className="text-sm text-muted-foreground mt-1">Choose notification channels for medication, location, and behavior alerts.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <Shield className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold text-foreground">Privacy Controls</p>
          <p className="text-sm text-muted-foreground mt-1">Manage doctor sharing access and report export permissions.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 hover-lift">
          <SlidersHorizontal className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold text-foreground">Care Workflow</p>
          <p className="text-sm text-muted-foreground mt-1">Tune reminder cadence and activity follow-up preferences.</p>
        </div>
      </section>
    </div>
  );
};

export default CaregiverSettings;

