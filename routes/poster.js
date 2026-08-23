const express = require("express");
const router = express.Router();
const posterController = require("../controllers/poster");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const handleUpload = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Invalid payload" });
    }
    next();
  });
};

router.get("/", posterController.list);
router.put("/reorder", authenticate, posterController.reorder);
router.get("/:slug", posterController.getBySlug);

router.post("/", authenticate, handleUpload, posterController.create);
router.put("/:id", authenticate, handleUpload, posterController.update);
router.delete("/:id", authenticate, posterController.remove);

module.exports = router;
