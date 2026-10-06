const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const userController = require("../controllers/user");
const { authenticate } = require("../middleware/auth");
const User = require("../models/user");

// Registration is only open while no admin account exists yet (initial
// setup). Once at least one admin exists, creating another admin requires
// being authenticated as an existing admin.
const bootstrapOrAuth = async (req, res, next) => {
  try {
    const existingAdminCount = await User.countDocuments();
    if (existingAdminCount === 0) {
      return next();
    }
    return authenticate(req, res, next);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Registration check failed" });
  }
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

// Per-account throttle on top of the per-IP one: slows password guessing
// against one account even when the attempts come from many IPs.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `acct:${String(req.body?.email || "").trim().toLowerCase()}`,
  skip: (req) => typeof req.body?.email !== "string",
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many attempts, please try again later" },
});

router.post("/register", authLimiter, bootstrapOrAuth, userController.register);
router.post("/login", authLimiter, accountLimiter, userController.login);
router.post("/refresh", authLimiter, userController.refresh);
router.post("/logout", userController.logout);

module.exports = router;
