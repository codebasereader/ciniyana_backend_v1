const express = require("express");
const router = express.Router();
const offTheCameraController = require("../controllers/offTheCamera");
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

router.get("/", offTheCameraController.list);
router.put("/reorder", authenticate, offTheCameraController.reorder);
router.get("/:slug", offTheCameraController.getBySlug);

router.post("/", authenticate, handleUpload, offTheCameraController.create);
router.put("/:id", authenticate, handleUpload, offTheCameraController.update);
router.delete("/:id", authenticate, offTheCameraController.remove);

module.exports = router;
