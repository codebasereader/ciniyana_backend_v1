const express = require("express");
const router = express.Router();
const articleController = require("../controllers/article");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const handleUpload = (req, res, next) => {
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
    { name: "gallery", maxCount: 50 },
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Invalid payload" });
    }
    next();
  });
};

router.get("/", articleController.list);
router.put("/reorder", authenticate, articleController.reorder);
router.get("/:slug", articleController.getBySlug);

router.post("/", authenticate, handleUpload, articleController.create);
router.put("/:id", authenticate, handleUpload, articleController.update);
router.delete("/:id", authenticate, articleController.remove);

module.exports = router;
