import { apiRequest } from "@/lib/api";

export const submitTangramSession = async (patientId, levels) => {
  if (!patientId) throw new Error("Patient context not available");
  return apiRequest(`/api/cognitive/${patientId}/tangram/submit`, {
    method: "POST",
    body: JSON.stringify({ levels }),
  });
};

export const getTangramTrend = async (patientId, limit = 12) => {
  if (!patientId) return { sessions: [] };
  return apiRequest(`/api/cognitive/${patientId}/tangram/trend?limit=${limit}`);
};
