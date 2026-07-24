const textEncoder = new TextEncoder();

export const SESSION_COOKIE = "atoms_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const PASSWORD_ITERATIONS = 120_000;
export const MAX_WORKSPACE_BYTES = 900_000;

function nowIso() {
  return new Date().toISOString();
}

function cryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto is required for account security");
  }
  return globalThis.crypto;
}

function base64UrlEncode(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  cryptoApi().getRandomValues(buffer);
  return base64UrlEncode(buffer);
}

async function sha256Base64Url(value) {
  const digest = await cryptoApi().subtle.digest("SHA-256", textEncoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 256;
}

export async function hashPassword(password, { iterations = PASSWORD_ITERATIONS } = {}) {
  const salt = new Uint8Array(16);
  cryptoApi().getRandomValues(salt);
  const key = await cryptoApi().subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return `pbkdf2-sha256:${iterations}:${base64UrlEncode(salt)}:${base64UrlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, iterationText, saltText, hashText] = String(storedHash || "").split(":");
  if (algorithm !== "pbkdf2-sha256" || !iterationText || !saltText || !hashText) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const salt = base64UrlDecode(saltText);
  const expected = base64UrlDecode(hashText);
  const key = await cryptoApi().subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    expected.byteLength * 8
  );
  const actual = new Uint8Array(bits);
  if (actual.byteLength !== expected.byteLength) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.byteLength; index += 1) mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}

export function createMemoryDataStore() {
  const values = new Map();
  return {
    async get(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

export function createDataStore(binding = createMemoryDataStore()) {
  return {
    async getJson(key) {
      const value = await binding.get(key);
      if (value == null) return null;
      if (typeof value === "string") return JSON.parse(value);
      return value;
    },
    async putJson(key, value) {
      await binding.put(key, JSON.stringify(value));
    },
    async delete(key) {
      await binding.delete(key);
    }
  };
}

function publicUser(user) {
  return { id: user.id, name: user.name || user.email?.split("@")[0] || "User", email: user.email, createdAt: user.createdAt };
}

function userKey(email) {
  return `user:${email}`;
}

async function sessionKey(token) {
  return `session:${await sha256Base64Url(token)}`;
}

function workspaceKey(userId) {
  return `workspace:${userId}`;
}

export function parseCookieHeader(header) {
  return String(header || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf("=");
      if (separator < 0) return cookies;
      cookies[item.slice(0, separator)] = decodeURIComponent(item.slice(separator + 1));
      return cookies;
    }, {});
}

export function getSessionToken(request) {
  const header = typeof request.headers?.get === "function" ? request.headers.get("Cookie") : request.headers?.cookie;
  return parseCookieHeader(header)[SESSION_COOKIE] || "";
}

export function createSessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function jsonByteLength(value) {
  return textEncoder.encode(JSON.stringify(value)).byteLength;
}

export function createAuthService(dataStore) {
  const store = createDataStore(dataStore);

  async function createSession(user) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    await store.putJson(await sessionKey(token), {
      userId: user.id,
      name: user.name,
      email: user.email,
      userCreatedAt: user.createdAt,
      expiresAt,
      createdAt: nowIso()
    });
    return { token, expiresAt };
  }

  async function register({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    if (!validateEmail(normalizedEmail)) throw Object.assign(new Error("请输入有效邮箱"), { status: 400 });
    if (!validatePassword(password)) throw Object.assign(new Error("密码至少需要 8 位"), { status: 400 });
    const key = userKey(normalizedEmail);
    if (await store.getJson(key)) throw Object.assign(new Error("邮箱已注册"), { status: 409 });
    const user = {
      id: `user_${randomToken(16)}`,
      name: String(name || normalizedEmail.split("@")[0] || "User").trim().slice(0, 60),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      createdAt: nowIso()
    };
    await store.putJson(key, user);
    const session = await createSession(user);
    return { user: publicUser(user), session };
  }

  async function login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const user = await store.getJson(userKey(normalizedEmail));
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw Object.assign(new Error("邮箱或密码错误"), { status: 401 });
    }
    const session = await createSession(user);
    return { user: publicUser(user), session };
  }

  async function getSession(token) {
    if (!token) return null;
    const key = await sessionKey(token);
    const session = await store.getJson(key);
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      await store.delete(key);
      return null;
    }
    return { user: publicUser({ id: session.userId, name: session.name, email: session.email, createdAt: session.userCreatedAt }), session };
  }

  async function logout(token) {
    if (token) await store.delete(await sessionKey(token));
  }

  async function requireUser(request) {
    const session = await getSession(getSessionToken(request));
    if (!session?.user) throw Object.assign(new Error("请先登录"), { status: 401 });
    return session.user;
  }

  async function getWorkspaceState(userId) {
    return await store.getJson(workspaceKey(userId));
  }

  async function putWorkspaceState(userId, state) {
    if (jsonByteLength(state) > MAX_WORKSPACE_BYTES) {
      throw Object.assign(new Error("工作区内容过大"), { status: 413 });
    }
    await store.putJson(workspaceKey(userId), state);
    return state;
  }

  return {
    register,
    login,
    logout,
    getSession,
    requireUser,
    getWorkspaceState,
    putWorkspaceState
  };
}
