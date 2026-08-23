const express = require("express");
const router = express.Router();
const remembranceController = require("../controllers/remembrance");
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

router.get("/", remembranceController.list);
router.put("/reorder", authenticate, remembranceController.reorder);
router.get("/:slug", remembranceController.getBySlug);

router.post("/", authenticate, handleUpload, remembranceController.create);
router.put("/:id", authenticate, handleUpload, remembranceController.update);
router.delete("/:id", authenticate, remembranceController.remove);

module.exports = router;
