const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const visitsController = require("../controllers/visits");

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests" },
});

router.post("/track", trackLimiter, visitsController.track);

module.exports = router;
