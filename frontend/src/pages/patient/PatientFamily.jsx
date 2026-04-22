import { Link } from "react-router-dom";
import { Phone, ArrowLeft } from "lucide-react";
import PatientLayout from "@/components/patient/PatientLayout";

const contacts = [
  { name: "Emily Johnson", relation: "Daughter", phone: "(555) 123-4567" },
  { name: "Michael Johnson", relation: "Son", phone: "(555) 234-5678" },
  { name: "Dr. Amanda Chen", relation: "Physician", phone: "(555) 567-8901" }
];

const PatientFamily = () => {
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto w-full space-y-4 pb-6">
        <Link to="/patient" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Family Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">Tap a contact for quick support.</p>
        </section>

        <section className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.phone} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover-lift">
              <div>
                <p className="font-semibold text-foreground">{contact.name}</p>
                <p className="text-sm text-muted-foreground">{contact.relation}</p>
              </div>
              <button className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Call
              </button>
            </div>
          ))}
        </section>
      </div>
    </PatientLayout>
  );
};

export default PatientFamily;
