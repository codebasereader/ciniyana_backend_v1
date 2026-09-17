const express = require("express");
const router = express.Router();
const videoController = require("../controllers/video");
const { authenticate } = require("../middleware/auth");

router.get("/", videoController.list);
router.put("/reorder", authenticate, videoController.reorder);
router.get("/:slug", videoController.getBySlug);

router.post("/", authenticate, videoController.create);
router.put("/:id", authenticate, videoController.update);
router.delete("/:id", authenticate, videoController.remove);

module.exports = router;
