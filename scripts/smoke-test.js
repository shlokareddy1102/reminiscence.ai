const BASE_URL = process.env.SMOKE_API_BASE_URL || "http://localhost:5001";
const HEALTH_PATH = "/api/health";
const LOGIN_PATH = "/api/auth/login";

const DEMO_EMAIL = process.env.SMOKE_EMAIL || "caregiver@test.com";
const DEMO_PASSWORD = process.env.SMOKE_PASSWORD || "password123";

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let body = null;
  try {
    body = await response.json();
  } catch (_err) {
    body = null;
  }

  return { response, body };
}

async function run() {
  console.log(`[smoke] API base: ${BASE_URL}`);

  const health = await requestJson(HEALTH_PATH);
  if (!health.response.ok || !health.body?.ok) {
    throw new Error(`[smoke] Health check failed (${health.response.status})`);
  }
  console.log("[smoke] Health check passed");

  const login = await requestJson(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  });

  if (!login.response.ok) {
    const message = login.body?.msg || login.body?.error || "Unknown login error";
    throw new Error(`[smoke] Login failed (${login.response.status}): ${message}`);
  }

  if (!login.body?.token || !login.body?.user?.role) {
    throw new Error("[smoke] Login response missing token/user payload");
  }

  console.log(`[smoke] Login passed for ${DEMO_EMAIL} (${login.body.user.role})`);
  console.log("[smoke] All checks passed");
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
