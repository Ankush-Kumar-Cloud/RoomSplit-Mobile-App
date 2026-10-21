import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";

// ──────────────────────────────────────────────
// Change this to your machine's IP when testing on a physical device
// Android emulator: 10.0.2.2 maps to localhost on host machine
// Physical device on same WiFi: use your machine's local IP e.g. 192.168.1.5
// ──────────────────────────────────────────────
// export const BASE_URL = 'https://roomsplit-mobile-app.onrender.com/api';
// export const SOCKET_URL = 'https://roomsplit-mobile-app.onrender.com';

export const BASE_URL = "http://10.110.171.52:5000/api";
export const SOCKET_URL = "http://10.110.171.52.52:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Connect manually when authenticated
});

const TOKEN_KEY = "@rs_token";
const REFRESH_KEY = "@rs_refresh";
const THEME_KEY = "@rs_theme";

// ── In-memory cache — loaded from AsyncStorage once at startup ─────────────
// Keeping tokens in memory avoids AsyncStorage I/O on every API call
let _token = null;
let _refresh = null;
let _isRefreshing = false;
let _refreshQueue = []; // Queues concurrent requests while refreshing

export const Token = {
  init: async () => {
    [_token, _refresh] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
  },
  save: async (access, refresh) => {
    _token = access;
    _refresh = refresh;
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, access),
      refresh ? AsyncStorage.setItem(REFRESH_KEY, refresh) : Promise.resolve(),
    ]);
  },
  clear: async () => {
    _token = null;
    _refresh = null;
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_KEY),
    ]);
  },
  get: () => _token,
  getRefresh: () => _refresh,
  exists: () => !!_token,
};

export const Theme = {
  save: (t) => AsyncStorage.setItem(THEME_KEY, t),
  load: () => AsyncStorage.getItem(THEME_KEY),
};

// ── Silent token refresh ────────────────────────────────────────────────────
// When access token expires, this function:
// 1. Calls /auth/refresh with the refresh token
// 2. Saves the new tokens
// 3. Replays all queued requests with the new token
// This is transparent to the user — no logout, no flash of login screen.
let _onLogout = null;
export const setLogoutHandler = (fn) => {
  _onLogout = fn;
};

const attemptRefresh = async () => {
  const refreshToken = Token.getRefresh();
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Refresh failed");

  await Token.save(json.token, json.refreshToken);
  return json.token;
};

// ── Core fetch wrapper ──────────────────────────────────────────────────────
const request = async (method, path, body, retried = false) => {
  const headers = { "Content-Type": "application/json" };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  // If access token expired, attempt a silent refresh and retry ONCE
  if (res.status === 401 && json.code === "TOKEN_EXPIRED" && !retried) {
    if (_isRefreshing) {
      // Another request is already refreshing — queue this one
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject });
      }).then((newToken) => {
        return request(method, path, body, true);
      });
    }

    _isRefreshing = true;
    try {
      await attemptRefresh();
      // Flush the queue with success
      _refreshQueue.forEach((p) => p.resolve());
      _refreshQueue = [];
      _isRefreshing = false;
      return request(method, path, body, true); // Retry the original request
    } catch (refreshError) {
      // Refresh also failed — session is dead, force logout
      _refreshQueue.forEach((p) => p.reject(refreshError));
      _refreshQueue = [];
      _isRefreshing = false;
      await Token.clear();
      _onLogout?.();
      throw new Error("Session expired. Please login again.");
    }
  }

  if (!res.ok)
    throw Object.assign(new Error(json.message || `HTTP ${res.status}`), {
      status: res.status,
    });
  return json;
};

const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: async (name, email, password) => {
    const data = await api.post("/auth/signup", { name, email, password });
    await Token.save(data.token, data.refreshToken);
    return data.user;
  },
  login: async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    await Token.save(data.token, data.refreshToken);
    return data.user;
  },
  logout: async () => {
    try {
      await api.post("/auth/logout", {});
    } catch (_) {}
    await Token.clear();
  },
  getMe: async () => {
    const d = await api.get("/auth/me");
    return d.user;
  },
  updateMe: async (name) => {
    const d = await api.put("/auth/me", { name });
    return d.user;
  },
  updatePushToken: (token) => api.post("/auth/push-token", { token }),
};

// ── GROUPS ────────────────────────────────────────────────────────────────────
export const groupsApi = {
  getAll: () => api.get("/groups"),
  create: (name) => api.post("/groups", { name }),
  join: (inviteCode) => api.post("/groups/join", { inviteCode }),
  update: (id, name) => api.put(`/groups/${id}`, { name }),
  leave: (id) => api.delete(`/groups/${id}/leave`),
};

// ── EXPENSES ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  // Now supports cursor pagination: pass cursor=<lastId> to fetch next page
  getAll: (gid, filters = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    );
    return api.get(`/groups/${gid}/expenses${qs.toString() ? "?" + qs : ""}`);
  },
  create: (gid, data) => api.post(`/groups/${gid}/expenses`, data),
  update: (gid, eid, data) => api.put(`/groups/${gid}/expenses/${eid}`, data),
  delete: (gid, eid) => api.delete(`/groups/${gid}/expenses/${eid}`),
  // Clears ALL expenses for a group in a specific month (YYYY-MM)
  clearMonth: (gid, month) => api.delete(`/groups/${gid}/expenses?month=${month}`),
};

// ── BUDGETS ───────────────────────────────────────────────────────────────────
export const budgetsApi = {
  getAll: (gid, month) => api.get(`/groups/${gid}/budgets?month=${month}`),
  upsert: (gid, userId, monthKey, amt) =>
    api.put(`/groups/${gid}/budgets`, { userId, monthKey, amount: amt }),
};

// ── SETTLEMENTS ───────────────────────────────────────────────────────────────
export const settlementsApi = {
  getAll: (gid, month) => api.get(`/groups/${gid}/settlements?month=${month}`),
  toggle: (gid, monthKey, idx) =>
    api.post(`/groups/${gid}/settlements/toggle`, { monthKey, txnIndex: idx }),
};
