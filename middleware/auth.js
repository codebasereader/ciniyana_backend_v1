const jwt = require("jsonwebtoken");
const User = require("../models/user");

const unauthorized = (res, code) =>
  res.status(401).json({ message: "Unauthorized", ...(code ? { code } : {}) });

exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ") ? header.slice(7) : null;
    // Cookie is the normal (browser) path; the Authorization header is kept
    // as a fallback for non-browser API clients.
    const token = req.cookies?.accessToken || bearerToken;

    if (!token) {
      return unauthorized(res);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "access") {
      return unauthorized(res);
    }

    // Only the most recent login is valid: the token's session id must match
    // the one stored on the account (also invalidates tokens after logout).
    const user = await User.findById(decoded.id).select("activeSessionId");
    if (!user || !user.activeSessionId) {
      return unauthorized(res);
    }
    if (decoded.sid !== user.activeSessionId) {
      return unauthorized(res, "SESSION_REPLACED");
    }

    req.user = decoded;
    next();
  } catch (error) {
    return unauthorized(res);
  }
};
