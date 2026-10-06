const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_EXPIRY || "8h";

/**
 * Cookies are Secure unless explicitly turned off. `COOKIE_SECURE=false` is
 * only for a local/UAT setup served over plain http (browsers drop Secure
 * cookies there); `NODE_ENV=development` also relaxes it for local work.
 */
function resolveSecure() {
  const flag = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "development";
}

const VALID_SAMESITE = ["lax", "strict", "none"];
function resolveSameSite(secure) {
  const value = String(process.env.COOKIE_SAMESITE || "").trim().toLowerCase();
  // "none" is rejected by browsers unless the cookie is also Secure.
  if (VALID_SAMESITE.includes(value) && (value !== "none" || secure)) return value;
  return "lax";
}

const secure = resolveSecure();

const MULTIPLIERS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/** Parses jsonwebtoken-style durations ("15m", "7d", "30", 30) into milliseconds. */
function parseDurationMs(value, fallbackMs) {
  if (typeof value === "number") return value * 1000;
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(String(value).trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  return amount * MULTIPLIERS[unit];
}

const baseCookieOptions = {
  httpOnly: true,
  secure,
  // "lax" works when the frontend and API share a registrable domain (also
  // localhost:5173 <-> localhost:5000 in dev). Set COOKIE_SAMESITE=none only
  // for a genuinely cross-site deployment (needs Secure).
  sameSite: resolveSameSite(secure),
  path: "/",
};

exports.accessTokenExpiryMs = () => parseDurationMs(ACCESS_TOKEN_TTL, 15 * 60 * 1000);
exports.refreshTokenExpiryMs = () => parseDurationMs(REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);

exports.setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie("accessToken", accessToken, {
    ...baseCookieOptions,
    maxAge: exports.accessTokenExpiryMs(),
  });
  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOptions,
    // Scoped narrower than "/" — only the refresh/logout flow ever needs to
    // see this cookie, so no other route can leak it.
    path: "/api/user/refresh",
    maxAge: exports.refreshTokenExpiryMs(),
  });
};

exports.clearAuthCookies = (res) => {
  res.clearCookie("accessToken", { ...baseCookieOptions });
  res.clearCookie("refreshToken", { ...baseCookieOptions, path: "/api/user/refresh" });
};
