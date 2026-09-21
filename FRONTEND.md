# Frontend integration — Auth

Base URL (local): `http://localhost:5000`

All auth endpoints use `Content-Type: application/json`.

---

## 1. Register

**POST** `/user/register`

Registration is only open (no `Authorization` header needed) when **no admin account exists yet** — i.e. the very first admin. Once at least one admin exists, this endpoint requires a valid admin `accessToken`; a logged-in admin creates any further admin accounts.

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

Register does **not** return tokens. After register, send the user to login.

### Errors

| Status | When |
|--------|------|
| `400` | Missing `name`, `email`, or `password` |
| `401` | An admin already exists and no valid `Authorization: Bearer <accessToken>` was sent |
| `409` | Email already registered |
| `429` | Too many attempts from this IP (rate limited) |
| `500` | Server error |

### Example (fetch)

```js
const register = async ({ name, email, password }, accessToken) => {
  const res = await fetch("http://localhost:5000/user/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
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
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "test@example.com",
    "role": "admin"
  }
}
```

| Token | Lifetime | Use |
|-------|----------|-----|
| `accessToken` | 15 minutes | Send on protected API calls |
| `refreshToken` | 7 days | Keep on the client for later use |

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));

  return data;
};
```

---

## 3. Store tokens after login

Save all three values from the login response:

```js
localStorage.setItem("accessToken", data.accessToken);
localStorage.setItem("refreshToken", data.refreshToken);
localStorage.setItem("user", JSON.stringify(data.user));
```

On app load, restore session:

```js
const accessToken = localStorage.getItem("accessToken");
const refreshToken = localStorage.getItem("refreshToken");
const user = JSON.parse(localStorage.getItem("user") || "null");
const isLoggedIn = Boolean(accessToken);
```

Logout:

```js
localStorage.removeItem("accessToken");
localStorage.removeItem("refreshToken");
localStorage.removeItem("user");
```

`localStorage` is simple for SPA work. Prefer `httpOnly` cookies in production if you control both apps on the same domain.

---

## 4. Call protected APIs with the access token

When a backend route requires auth, send:

```
Authorization: Bearer <accessToken>
```

```js
const apiFetch = async (path, options = {}) => {
  const accessToken = localStorage.getItem("accessToken");

  const res = await fetch(`http://localhost:5000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Success — `200`

```json
{
  "message": "Token refreshed",
  "accessToken": "...",
  "refreshToken": "..."
}
```

Both tokens are reissued (rotate the stored `refreshToken` to the new value too). Access tokens expire quickly (15 min by default); call this endpoint instead of forcing a full re-login.

### Errors

| Status | When |
|--------|------|
| `400` | Missing `refreshToken` |
| `401` | Refresh token invalid, expired, or not a refresh token |
| `429` | Too many attempts from this IP (rate limited) |

```js
const refresh = async (refreshToken) => {
  const res = await fetch("http://localhost:5000/user/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  return data;
};
```

---

## 5. Example UI flow

1. **Register page** — form: `name`, `email`, `password` (optional `role`). On success, redirect to login.
2. **Login page** — form: `email`, `password`. On success, save tokens + user, redirect to dashboard.
3. **Dashboard / protected pages** — if `accessToken` is missing, redirect to login. Attach `Authorization: Bearer ...` on API calls.
4. **Logout** — clear storage and redirect to login.

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
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = (payload) => api.post("/user/login", payload);
export const register = (payload) => api.post("/user/register", payload);
```

After `login`, save `response.data.accessToken` and `response.data.refreshToken` the same way as above.

---

## 7. CORS

The backend only accepts cross-origin requests from an allowlist, not from any origin. By default that's `http://localhost:3000`, `http://localhost:5173`, and their `127.0.0.1` equivalents. A request from any other origin gets a `403 { "message": "Not allowed by CORS" }`.

To add your deployed frontend's domain, set `ALLOWED_ORIGINS` in the backend's `.env` (comma-separated, no trailing slash):

```
ALLOWED_ORIGINS=https://your-frontend.example.com,http://localhost:3000
```
