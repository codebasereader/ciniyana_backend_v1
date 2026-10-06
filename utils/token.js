const jwt = require("jsonwebtoken");

exports.generateTokens = (user, sid) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET must be set in .env");
  }

  const basePayload = {
    id: user._id,
    email: user.email,
    role: user.role,
    sid,
  };

  const accessToken = jwt.sign({ ...basePayload, type: "access" }, secret, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });

  const refreshToken = jwt.sign({ ...basePayload, type: "refresh" }, secret, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "8h",
  });

  return { accessToken, refreshToken };
};

exports.verifyRefreshToken = (token) => {
  const secret = process.env.JWT_SECRET;
  const decoded = jwt.verify(token, secret);

  if (decoded.type !== "refresh") {
    throw new Error("Not a refresh token");
  }

  return decoded;
};
