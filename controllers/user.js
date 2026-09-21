const bcrypt = require("bcryptjs");
const User = require("../models/user");
const { generateTokens, verifyRefreshToken } = require("../utils/token");
const { setAuthCookies, clearAuthCookies, accessTokenExpiryMs } = require("../utils/cookies");

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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
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

    const tokens = generateTokens(user);
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

exports.logout = (req, res) => {
  clearAuthCookies(res);
  return res.status(200).json({ message: "Logged out" });
};
