const express = require("express");
const router = express.Router();
const flashBackController = require("../controllers/flashback");
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

router.get("/", flashBackController.list);
router.put("/reorder", authenticate, flashBackController.reorder);
router.get("/:slug", flashBackController.getBySlug);

router.post("/", authenticate, handleUpload, flashBackController.create);
router.put("/:id", authenticate, handleUpload, flashBackController.update);
router.delete("/:id", authenticate, flashBackController.remove);

module.exports = router;
