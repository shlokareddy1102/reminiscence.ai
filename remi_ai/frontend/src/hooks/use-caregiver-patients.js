import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

export const SELECTED_PATIENT_KEY = "caregiverSelectedPatientId";

// Centralizes patient selection so every caregiver page reads/writes the same state key.
export const useCaregiverPatients = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const patientList = await apiRequest("/api/patient/list");
      const normalized = Array.isArray(patientList) ? patientList : [];
      setPatients(normalized);

      const saved = localStorage.getItem(SELECTED_PATIENT_KEY);
      const savedExists = normalized.some((p) => p._id === saved);
      const initial = savedExists ? saved : normalized[0]?._id || null;

      if (initial) {
        localStorage.setItem(SELECTED_PATIENT_KEY, initial);
        setSelectedPatientId(initial);
      }
    } catch (_err) {
      // Keep empty state for pages to render fallback UI.
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const setPatient = useCallback((patientId) => {
    if (!patientId) return;
    localStorage.setItem(SELECTED_PATIENT_KEY, patientId);
    setSelectedPatientId(patientId);
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((p) => p._id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  return {
    patients,
    selectedPatient,
    selectedPatientId,
    loadingPatients,
    setPatient,
    reloadPatients: loadPatients
  };
};
