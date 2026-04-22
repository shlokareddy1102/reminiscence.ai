export function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem("token");
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function hasRole(role) {
  const user = getCurrentUser();
  return user?.role === role;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

const PATIENT_PREVIEW_MODE_KEY = "patientPreviewMode";
const PATIENT_PREVIEW_ID_KEY = "patientPreviewId";

export function enablePatientPreview(patientId) {
  localStorage.setItem(PATIENT_PREVIEW_MODE_KEY, "true");
  if (patientId) {
    localStorage.setItem(PATIENT_PREVIEW_ID_KEY, patientId);
  }
}

export function clearPatientPreview() {
  localStorage.removeItem(PATIENT_PREVIEW_MODE_KEY);
  localStorage.removeItem(PATIENT_PREVIEW_ID_KEY);
}

export function isPatientPreviewEnabled() {
  return localStorage.getItem(PATIENT_PREVIEW_MODE_KEY) === "true";
}

export function getPatientPreviewId() {
  return localStorage.getItem(PATIENT_PREVIEW_ID_KEY);
}
