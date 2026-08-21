const multer = require("multer");
const path = require("path");
const fs = require("fs");

const tempDir = path.join(__dirname, "..", "images", "flashback", "temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `upload-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (allowed.test(ext) || allowed.test(file.mimetype.split("/")[1] || "")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
