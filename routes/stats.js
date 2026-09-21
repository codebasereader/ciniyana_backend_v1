const express = require("express");
const router = express.Router();
const statsController = require("../controllers/stats");
const { authenticate } = require("../middleware/auth");

router.get("/posts", authenticate, statsController.posts);

module.exports = router;
