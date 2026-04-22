const configuredBase = import.meta.env.VITE_API_BASE_URL || "";
const fallbackBases = ["http://localhost:5001", "http://localhost:5002", "http://localhost:5003", "http://localhost:5004"];

const getStoredBase = () => {
  try {
    return localStorage.getItem("resolvedApiBaseUrl") || "";
  } catch (_err) {
    return "";
  }
};

const setStoredBase = (base) => {
  try {
    localStorage.setItem("resolvedApiBaseUrl", base);
  } catch (_err) {
    // Ignore storage errors and continue with in-memory base URL.
  }
};

const getCandidateBases = () => {
  const candidates = [configuredBase, getStoredBase(), ...fallbackBases].filter(Boolean);
  return [...new Set(candidates)];
};

export let API_BASE_URL = getCandidateBases()[0] || "http://localhost:5001";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const candidates = getCandidateBases();
  let response = null;
  let connectedBase = "";
  let lastConnectionError = null;

  for (const base of candidates) {
    try {
      response = await fetch(`${base}${path}`, {
        ...options,
        headers
      });
      connectedBase = base;
      break;
    } catch (err) {
      lastConnectionError = err;
    }
  }

  if (!response) {
    const tried = candidates.join(", ");
    throw new Error(`Cannot reach backend. Tried: ${tried}. ${lastConnectionError?.message || ""}`.trim());
  }

  if (connectedBase && API_BASE_URL !== connectedBase) {
    API_BASE_URL = connectedBase;
    setStoredBase(connectedBase);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_err) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error || "Request failed";
    throw new Error(message);
  }

  return data;
}
