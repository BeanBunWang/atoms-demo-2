async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function getSession() {
  try {
    return await request("/api/auth/session");
  } catch (error) {
    if (error.status === 401) return { user: null };
    throw error;
  }
}

export function registerAccount({ name, email, password }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
}

export function loginAccount({ email, password }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function logoutAccount() {
  return request("/api/auth/logout", { method: "POST", body: "{}" });
}

export async function loadCloudWorkspaceState() {
  return await request("/api/workspaces");
}

export function saveCloudWorkspaceState(state) {
  return request("/api/workspaces", {
    method: "PUT",
    body: JSON.stringify(state)
  });
}
