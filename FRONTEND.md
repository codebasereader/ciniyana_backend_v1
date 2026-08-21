# Frontend integration — Auth

Base URL (local): `http://localhost:5000`

All auth endpoints use `Content-Type: application/json`.

---

## 1. Register

**POST** `/user/register`

### Request body

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "secret123",
  "role": "admin"
}
```

`role` is optional. If omitted, it defaults to `"admin"`. Currently the only allowed role is `"admin"`.

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
| `400` | Missing `name`, `email`, or `password`, or invalid `role` |
| `409` | Email already registered |
| `500` | Server error |

### Example (fetch)

```js
const register = async ({ name, email, password, role = "admin" }) => {
  const res = await fetch("http://localhost:5000/user/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
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

If you get `401`, the access token is missing or expired. Send the user back to login (there is no refresh API on this backend).

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

The backend already enables CORS. For a frontend on another origin (for example `http://localhost:3000` or `http://localhost:5173`), no extra header work is needed for these JSON calls.

If you later switch the frontend origin, keep using the same base URL: `http://localhost:5000`.
