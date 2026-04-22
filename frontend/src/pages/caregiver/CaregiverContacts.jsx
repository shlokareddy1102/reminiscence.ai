import { useEffect, useState } from "react";
import ContactCard from "@/components/caregiver/ContactCard";
import { Users, Plus, Heart, X } from "lucide-react";
import { apiRequest } from "@/lib/api";

const SELECTED_PATIENT_KEY = "caregiverSelectedPatientId";

const lovedOnes = [
  { id: "1", name: "Emily Johnson", relationship: "Daughter", phone: "(555) 123-4567" },
  { id: "2", name: "Michael Johnson", relationship: "Son", phone: "(555) 234-5678" },
  { id: "3", name: "Robert Smith", relationship: "Brother", phone: "(555) 345-6789" }
];

const caregivers = [
  { id: "c1", name: "Sarah Williams", relationship: "Primary Caregiver", phone: "(555) 456-7890", isCaregiver: true },
  { id: "c2", name: "Dr. Amanda Chen", relationship: "Physician", phone: "(555) 567-8901", isCaregiver: true },
  { id: "c3", name: "Nurse Patricia", relationship: "Home Nurse", phone: "(555) 678-9012", isCaregiver: true }
];

const CaregiverContacts = () => {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(null);
  const [patientName, setPatientName] = useState("Josh Thompson");
  const [lovedOnesList, setLovedOnesList] = useState(lovedOnes);
  const [caregiversList, setCaregiversList] = useState(caregivers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", relationship: "", phone: "", type: "loved-one" });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const patientList = await apiRequest("/api/patient/list");
        if (Array.isArray(patientList)) {
          setPatients(patientList);
        }

        const savedPatientId = localStorage.getItem(SELECTED_PATIENT_KEY);
        const savedPatient = Array.isArray(patientList)
          ? patientList.find((p) => p._id === savedPatientId)
          : null;

        const patient = savedPatient || (Array.isArray(patientList) && patientList.length
          ? patientList[0]
          : await apiRequest("/api/patient"));
        if (!patient) return;

        if (patient._id) localStorage.setItem(SELECTED_PATIENT_KEY, patient._id);
        if (patient.name) setPatientName(patient.name);
        if (patient._id) setPatientId(patient._id);

        const cg = Array.isArray(patient.caregivers)
          ? patient.caregivers.map((entry, idx) => ({
              id: `c${idx}`,
              name: entry.name,
              relationship: entry.role === "medical" ? "Medical Caregiver" : "Family Caregiver",
              phone: "Not provided",
              isCaregiver: true
            }))
          : [];

        if (cg.length > 0) {
          setCaregiversList(cg);
        }
      } catch (_err) {
        // Use fallback sample contacts if API fails.
      }
    };

    loadContacts();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    localStorage.setItem(SELECTED_PATIENT_KEY, patientId);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    const loadByPatient = async () => {
      try {
        const patient = await apiRequest(`/api/patient/${patientId}`);
        if (!patient) return;

        if (patient.name) setPatientName(patient.name);

        const cg = Array.isArray(patient.caregivers)
          ? patient.caregivers.map((entry, idx) => ({
              id: `c${idx}`,
              name: entry.name,
              relationship: entry.role === "medical" ? "Medical Caregiver" : "Family Caregiver",
              phone: "Not provided",
              isCaregiver: true
            }))
          : [];

        if (cg.length > 0) {
          setCaregiversList(cg);
        }
      } catch (_err) {
        // Keep previous values if patient reload fails.
      }
    };

    loadByPatient();
  }, [patientId]);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.relationship.trim()) errors.relationship = "Relationship is required";
    if (!formData.phone.trim()) errors.phone = "Phone is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddContact = () => {
    if (!validateForm()) return;

    const newContact = {
      id: `${formData.type === "loved-one" ? "" : "c"}${Date.now()}`,
      name: formData.name,
      relationship: formData.relationship,
      phone: formData.phone,
      isCaregiver: formData.type === "caregiver"
    };

    if (formData.type === "loved-one") {
      setLovedOnesList([...lovedOnesList, newContact]);
    } else {
      setCaregiversList([...caregiversList, newContact]);
    }

    setFormData({ name: "", relationship: "", phone: "", type: "loved-one" });
    setFormErrors({});
    setShowAddModal(false);
  };

  const handleDeleteContact = (id, type) => {
    if (type === "loved-one") {
      setLovedOnesList(lovedOnesList.filter(c => c.id !== id));
    } else {
      setCaregiversList(caregiversList.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Contacts & Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage {patientName}'s care team and loved ones</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-w-48"
              value={patientId || ""}
              onChange={(e) => {
                localStorage.setItem(SELECTED_PATIENT_KEY, e.target.value);
                setPatientId(e.target.value);
              }}
            >
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>{patient.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-calm">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Contact</span>
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
              <span className="text-3xl font-display font-bold text-primary">{patientName?.[0] || "P"}</span>
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">{patientName}</h2>
              <p className="text-muted-foreground">Patient ID: PT-2024-0847</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs px-3 py-1 rounded-full bg-safe/20 text-safe font-medium whitespace-nowrap">Active Monitoring</span>
                <span className="text-xs px-3 py-1 rounded-full bg-accent/20 text-accent font-medium whitespace-nowrap">AI Assistant Enabled</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-semibold text-foreground">Loved Ones</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {lovedOnesList.map((contact) => (
              <ContactCard key={contact.id} {...contact} onDelete={() => handleDeleteContact(contact.id, "loved-one")} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-semibold text-foreground">Care Team</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {caregiversList.map((contact) => (
              <ContactCard key={contact.id} {...contact} onDelete={() => handleDeleteContact(contact.id, "caregiver")} />
            ))}
          </div>
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-card rounded-2xl shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h3 className="text-xl font-display font-bold text-foreground">Add New Contact</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: "", relationship: "", phone: "", type: "loved-one" });
                    setFormErrors({});
                  }}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Contact Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="loved-one">Loved One / Family</option>
                    <option value="caregiver">Care Team Member</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Jane Smith"
                    className={`w-full px-3 py-2 rounded-lg border ${formErrors.name ? "border-red-500" : "border-border"} bg-background`}
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Relationship / Role</label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    placeholder="e.g., Daughter, Nurse, Doctor"
                    className={`w-full px-3 py-2 rounded-lg border ${formErrors.relationship ? "border-red-500" : "border-border"} bg-background`}
                  />
                  {formErrors.relationship && <p className="text-xs text-red-500 mt-1">{formErrors.relationship}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className={`w-full px-3 py-2 rounded-lg border ${formErrors.phone ? "border-red-500" : "border-border"} bg-background`}
                  />
                  {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({ name: "", relationship: "", phone: "", type: "loved-one" });
                      setFormErrors({});
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                  >
                    Add Contact
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default CaregiverContacts;
