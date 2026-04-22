const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
export const API_BASE_URL = BASE_URL;

const checkBackend = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error();
    }
  } catch (_err) {
    throw new Error(`Backend is not running on ${BASE_URL}`);
  }
};

export async function apiRequest(path, options = {}) {
  await checkBackend();

  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  let response = null;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (_err) {
    throw new Error(`Backend is not running on ${BASE_URL}`);
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
