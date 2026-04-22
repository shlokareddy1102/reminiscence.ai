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
