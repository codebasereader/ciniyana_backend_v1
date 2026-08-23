const express = require("express");
const router = express.Router();
const infoSpecialController = require("../controllers/infoSpecial");
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

router.get("/", infoSpecialController.list);
router.put("/reorder", authenticate, infoSpecialController.reorder);
router.get("/:slug", infoSpecialController.getBySlug);

router.post("/", authenticate, handleUpload, infoSpecialController.create);
router.put("/:id", authenticate, handleUpload, infoSpecialController.update);
router.delete("/:id", authenticate, infoSpecialController.remove);

module.exports = router;
