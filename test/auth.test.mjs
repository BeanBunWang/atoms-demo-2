import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryDataStore } from "../backend/auth.mjs";
import { createWorker } from "../worker.mjs";

function testEnv() {
  return {
    DEEPSEEK_API_KEY: "server-secret",
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    ASSETS: { fetch: async () => new Response("asset") },
    AGENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ATOMS_DATA: createMemoryDataStore()
  };
}

function cookiePair(response) {
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  return cookie.split(";")[0];
}

async function register(worker, env, email = `user-${crypto.randomUUID()}@example.com`) {
  const response = await worker.fetch(new Request("https://atoms.example/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://atoms.example" },
    body: JSON.stringify({ email, password: "correct-password" })
  }), env);
  return response;
}

test("注册会创建账号并拒绝重复邮箱", async () => {
  const worker = createWorker();
  const env = testEnv();
  const email = `duplicate-${crypto.randomUUID()}@example.com`;

  const first = await register(worker, env, email);
  assert.equal(first.status, 201);
  assert.equal((await first.json()).user.email, email);

  const duplicate = await register(worker, env, email.toUpperCase());
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: "邮箱已注册" });
});

test("登录会拒绝错误密码", async () => {
  const worker = createWorker();
  const env = testEnv();
  const email = `wrong-password-${crypto.randomUUID()}@example.com`;
  assert.equal((await register(worker, env, email)).status, 201);

  const response = await worker.fetch(new Request("https://atoms.example/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://atoms.example" },
    body: JSON.stringify({ email, password: "not-the-password" })
  }), env);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "邮箱或密码错误" });
});

test("会话查询与退出登录使用 HttpOnly Cookie", async () => {
  const worker = createWorker();
  const env = testEnv();
  const email = `session-${crypto.randomUUID()}@example.com`;
  const cookie = cookiePair(await register(worker, env, email));

  const session = await worker.fetch(new Request("https://atoms.example/api/auth/session", {
    headers: { Cookie: cookie }
  }), env);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.email, email);

  const logout = await worker.fetch(new Request("https://atoms.example/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://atoms.example" }
  }), env);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);

  const afterLogout = await worker.fetch(new Request("https://atoms.example/api/auth/session", {
    headers: { Cookie: cookie }
  }), env);
  assert.deepEqual(await afterLogout.json(), { user: null });
});

test("工作区接口需要登录并按用户持久化完整状态", async () => {
  const worker = createWorker();
  const env = testEnv();

  const unauthorized = await worker.fetch(new Request("https://atoms.example/api/workspaces"), env);
  assert.equal(unauthorized.status, 401);

  const cookie = cookiePair(await register(worker, env));
  const state = {
    version: 5,
    activeWorkspaceId: "workspace-1",
    workspaces: [{ id: "workspace-1", title: "Cloud workspace", agents: [], messages: [], files: [] }]
  };
  const saved = await worker.fetch(new Request("https://atoms.example/api/workspaces", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://atoms.example" },
    body: JSON.stringify(state)
  }), env);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), state);

  const loaded = await worker.fetch(new Request("https://atoms.example/api/workspaces", {
    headers: { Cookie: cookie }
  }), env);
  assert.equal(loaded.status, 200);
  assert.deepEqual(await loaded.json(), state);
});
