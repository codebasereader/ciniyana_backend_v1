# Frontend integration — Auth

Base URL (local): `http://localhost:5000`

All auth endpoints use `Content-Type: application/json`.

**Every request to this API (including plain page loads of protected data) must be made with `credentials: 'include'`** (fetch) or `withCredentials: true` (axios). Auth no longer travels as a bearer token you manage — `accessToken` and `refreshToken` are set by the server as `httpOnly` cookies and the browser attaches them automatically. Your JS never sees the raw tokens.

---

## 1. Register

**POST** `/user/register`

Registration is only open (no cookie needed) when **no admin account exists yet** — i.e. the very first admin. Once at least one admin exists, this endpoint requires the caller to already be a logged-in admin (their session cookie is sent automatically by the browser).

### Request body

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "secret123"
}
```

Every account created here is an `"admin"` — there is no client-controlled `role` field.

### Success — `201`

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "test@example.com",
    "role": "admin"
  }
}
```

Register does **not** log the caller in (no cookies are set). After register, send the user to login.

### Errors

| Status | When |
|--------|------|
| `400` | Missing `name`, `email`, or `password` |
| `401` | An admin already exists and the caller isn't a logged-in admin |
| `409` | Email already registered |
| `429` | Too many attempts from this IP (rate limited) |
| `500` | Server error |

### Example (fetch)

```js
const register = async ({ name, email, password }) => {
  const res = await fetch("http://localhost:5000/user/register", {
    method: "POST",
    credentials: "include", // sends the admin's session cookie, if any
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data;
};
```

---

## 2. Login

**POST** `/user/login`

### Request body

```json
{
  "email": "test@example.com",
  "password": "secret123"
}
```

### Success — `200`

```json
{
  "message": "Login successful",
  "accessTokenExpiresAt": 1735599999000,
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "test@example.com",
    "role": "admin"
  }
}
```

The response body never contains the raw tokens — they're set as `httpOnly` cookies on the response (`Set-Cookie`), invisible to JS. `accessTokenExpiresAt` is a plain epoch-ms timestamp so the client can schedule a proactive refresh without ever holding the token itself.

| Cookie | Lifetime | Scope |
|--------|----------|-------|
| `accessToken` | 15 minutes (configurable) | Sent on every request (`Path=/`) |
| `refreshToken` | 7 days | Only sent to `/user/refresh` (`Path=/user/refresh`) |

### Errors

| Status | When |
|--------|------|
| `400` | Missing `email` or `password` |
| `401` | Wrong email or password |
| `500` | Server error |

### Example (fetch)

```js
const login = async ({ email, password }) => {
  const res = await fetch("http://localhost:5000/user/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  // Only non-sensitive UI hints — never the tokens themselves.
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("accessTokenExpiresAt", String(data.accessTokenExpiresAt));

  return data;
};
```

---

## 3. Restoring session on app load

The cookies are `httpOnly`, so you can't check them directly. Treat `user` in `localStorage` as an optimistic "was logged in" hint, then validate it for real with a refresh call (see below) — if that fails, treat the user as logged out.

```js
const user = JSON.parse(localStorage.getItem("user") || "null");
const accessTokenExpiresAt = Number(localStorage.getItem("accessTokenExpiresAt")) || null;
const maybeLoggedIn = Boolean(user);
```

Logout — **must** call the server; the cookies are `httpOnly` so client JS cannot clear them itself:

```js
await fetch("http://localhost:5000/user/logout", {
  method: "POST",
  credentials: "include",
});
localStorage.removeItem("user");
localStorage.removeItem("accessTokenExpiresAt");
```

---

## 4. Calling protected APIs

No `Authorization` header to manage — just send `credentials: 'include'` and the browser attaches the `accessToken` cookie automatically.

```js
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`http://localhost:5000${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};
```

If you get `401`, the access token is missing or expired — call `/user/refresh` (see below) to get a new one, or send the user back to login if refresh also fails.

---

## 4b. Refresh the access token

**POST** `/user/refresh`

No request body needed in the browser — the `refreshToken` cookie is sent automatically (it's scoped to this path). No `Authorization` header either.

### Success — `200`

```json
{
  "message": "Token refreshed",
  "accessTokenExpiresAt": 1735600899000
}
```

Both cookies are reissued (the refresh token rotates on every call). Access tokens expire quickly; call this endpoint instead of forcing a full re-login.

### Errors

| Status | When |
|--------|------|
| `400` | No refresh token cookie present |
| `401` | Refresh token invalid, expired, or not a refresh token |
| `429` | Too many attempts from this IP (rate limited) |

```js
const refresh = async () => {
  const res = await fetch("http://localhost:5000/user/refresh", {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  localStorage.setItem("accessTokenExpiresAt", String(data.accessTokenExpiresAt));
  return data;
};
```

---

## 4c. Logout

**POST** `/user/logout`

Clears both cookies server-side. No body, no auth required (safe to call even if the session already looks dead).

```json
{ "message": "Logged out" }
```

---

## 5. Example UI flow

1. **Register page** — form: `name`, `email`, `password`. On success, redirect to login.
2. **Login page** — form: `email`, `password`. On success, save `user` + `accessTokenExpiresAt`, redirect to dashboard.
3. **Dashboard / protected pages** — if no `user` hint, redirect to login. Every request uses `credentials: 'include'`; on `401`, try `/user/refresh` once, retry, and log out if that also fails.
4. **Logout** — call `/user/logout`, then clear local storage and redirect to login.

### React sketch

```jsx
const handleLogin = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);

  const data = await login({
    email: form.get("email"),
    password: form.get("password"),
  });

  navigate("/dashboard");
};
```

---

## 6. Axios alternative

```js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true, // sends/receives the httpOnly auth cookies
});

export const login = (payload) => api.post("/user/login", payload);
export const register = (payload) => api.post("/user/register", payload);
export const refresh = () => api.post("/user/refresh");
export const logout = () => api.post("/user/logout");
```

After `login`, save `response.data.user` and `response.data.accessTokenExpiresAt` the same way as above — never the raw tokens, since the response no longer contains them.

---

## 7. CORS

The backend only accepts cross-origin requests from an allowlist, not from any origin. By default that's `http://localhost:3000`, `http://localhost:5173`, and their `127.0.0.1` equivalents. A request from any other origin gets a `403 { "message": "Not allowed by CORS" }`.

`credentials: true` is enabled on the CORS config to allow the auth cookies through — this only works together with `credentials: 'include'` on the client (see above) and a specific allowlisted origin (never `*`).

To add your deployed frontend's domain, set `ALLOWED_ORIGINS` in the backend's `.env` (comma-separated, no trailing slash):

```
ALLOWED_ORIGINS=https://your-frontend.example.com,http://localhost:3000
```

### Cookie `SameSite` and deployment topology

In development, cookies are set with `SameSite=Lax` (works because `localhost:5173` and `localhost:5000` share the same registrable domain). In production (`NODE_ENV=production`), cookies switch to `SameSite=None; Secure`, which requires **HTTPS on both the frontend and the API** — this works regardless of whether the frontend and API share a domain.
