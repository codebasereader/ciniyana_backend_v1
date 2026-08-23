const express = require("express");
const router = express.Router();
const filmTodayController = require("../controllers/filmToday");
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

router.get("/", filmTodayController.list);
router.put("/reorder", authenticate, filmTodayController.reorder);
router.get("/:slug", filmTodayController.getBySlug);

router.post("/", authenticate, handleUpload, filmTodayController.create);
router.put("/:id", authenticate, handleUpload, filmTodayController.update);
router.delete("/:id", authenticate, filmTodayController.remove);

module.exports = router;
