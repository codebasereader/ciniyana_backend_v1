const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_EXPIRY || "7d";
const isProd = process.env.NODE_ENV === "production";

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
  secure: isProd,
  // Same registrable domain in dev (localhost:5173 <-> localhost:5000) works
  // with "lax"; cross-site production deployments need "none" (requires
  // secure: true, which is set above).
  sameSite: isProd ? "none" : "lax",
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
    path: "/user/refresh",
    maxAge: exports.refreshTokenExpiryMs(),
  });
};

exports.clearAuthCookies = (res) => {
  res.clearCookie("accessToken", { ...baseCookieOptions });
  res.clearCookie("refreshToken", { ...baseCookieOptions, path: "/user/refresh" });
};
