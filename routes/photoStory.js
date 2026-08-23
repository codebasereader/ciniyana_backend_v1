const express = require("express");
const router = express.Router();
const photoStoryController = require("../controllers/photoStory");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const handleUpload = (req, res, next) => {
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 50 },
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Invalid payload" });
    }
    next();
  });
};

router.get("/", photoStoryController.list);
router.put("/reorder", authenticate, photoStoryController.reorder);
router.get("/:slug", photoStoryController.getBySlug);

router.post("/", authenticate, handleUpload, photoStoryController.create);
router.put("/:id", authenticate, handleUpload, photoStoryController.update);
router.delete("/:id", authenticate, photoStoryController.remove);

module.exports = router;
