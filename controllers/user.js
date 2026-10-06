const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const { generateTokens, verifyRefreshToken } = require("../utils/token");
const { audit } = require("../utils/audit");
const { setAuthCookies, clearAuthCookies, accessTokenExpiryMs } = require("../utils/cookies");

// Compared against when the email is unknown so a missing account costs the
// same time as a wrong password (prevents account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email and password are required",
      });
    }

    // Role is always "admin" - it is never taken from client input.
    const userRole = "admin";

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    const isPasswordValid = await bcrypt.compare(
      password,
      user ? user.password : DUMMY_HASH
    );
    if (!user || !isPasswordValid) {
      audit(req, "auth.login_failed", { actor: email.toLowerCase() });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // New login replaces any previous session for this account.
    const sid = crypto.randomUUID();
    user.activeSessionId = sid;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user, sid);
    audit(req, "auth.login", { actor: user.email });
    setAuthCookies(res, { accessToken, refreshToken });

    return res.status(200).json({
      message: "Login successful",
      accessTokenExpiresAt: Date.now() + accessTokenExpiryMs(),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Login failed",
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    // Cookie is the normal (browser) path; body is kept as a fallback for
    // non-browser API clients that can't rely on cookies.
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    if (!user.activeSessionId || decoded.sid !== user.activeSessionId) {
      clearAuthCookies(res);
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        code: "SESSION_REPLACED",
      });
    }

    const tokens = generateTokens(user, user.activeSessionId);
    setAuthCookies(res, tokens);

    return res.status(200).json({
      message: "Token refreshed",
      accessTokenExpiresAt: Date.now() + accessTokenExpiryMs(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to refresh token",
    });
  }
};

exports.logout = async (req, res) => {
  // Revoke server-side too, so a copied token stops working after logout.
  try {
    const token = req.cookies?.accessToken || req.cookies?.refreshToken;
    const decoded = token ? jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true }) : null;
    if (decoded?.id) {
      await User.updateOne(
        { _id: decoded.id, activeSessionId: decoded.sid },
        { $set: { activeSessionId: null } }
      );
      audit(req, "auth.logout", { actor: decoded.email });
    }
  } catch {
    // Expired/invalid token — nothing to revoke, still clear the cookies.
  }
  clearAuthCookies(res);
  return res.status(200).json({ message: "Logged out" });
};
