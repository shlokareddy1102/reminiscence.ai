type Patient = {
  _id: string;
  name: string;
};

interface PatientSwitcherProps {
  patients: Patient[];
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}

const PatientSwitcher = ({
  patients,
  value,
  onChange,
  label = "Selected patient",
  className = ""
}: PatientSwitcherProps) => {
  return (
    <div className={className}>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {patients.map((patient) => (
          <option key={patient._id} value={patient._id}>
            {patient.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PatientSwitcher;
