const multer = require("multer");
const path = require("path");
const fs = require("fs");

const tempDir = path.join(__dirname, "..", "images", "temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Inner ".xxx" segments that must never appear before the final extension
// (e.g. shell.php.jpg). Image extensions are included so a.jpg.png is refused
// too; harmless dots such as "Photo.01.jpg" are still fine.
const BLOCKED_INNER_EXTENSIONS = new Set([
  ".php", ".php3", ".php4", ".php5", ".php7", ".phtml", ".phar", ".pht",
  ".asp", ".aspx", ".jsp", ".jspx", ".cgi", ".pl", ".py", ".rb", ".sh", ".bash",
  ".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".js", ".mjs", ".html", ".htm",
  ".shtml", ".svg", ".xml", ".htaccess", ".jpg", ".jpeg", ".png", ".webp", ".gif",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

/** Returns an error message if the filename is not acceptable, else null. */
function validateFilename(originalname) {
  const name = String(originalname || "");
  if (name.includes("\0")) return "Invalid file name";

  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return "Only image files are allowed";

  const stem = path.basename(name, path.extname(name));
  const innerExtensions = stem.match(/\.[A-Za-z0-9]{1,8}(?=\.|$)/g) || [];
  if (innerExtensions.some((inner) => BLOCKED_INNER_EXTENSIONS.has(inner.toLowerCase()))) {
    return "Files with multiple extensions are not allowed";
  }
  return null;
}

const fileFilter = (req, file, cb) => {
  const nameError = validateFilename(file.originalname);
  if (nameError) return cb(new Error(nameError));
  // Extension AND declared mimetype must both be images (was OR).
  if (!ALLOWED_MIMES.has(String(file.mimetype).toLowerCase())) {
    return cb(new Error("Only image files are allowed"));
  }
  cb(null, true);
};

/** Detects the real image type from the file's leading bytes. */
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return ".png";
  }
  const head6 = buffer.subarray(0, 6).toString("latin1");
  if (head6 === "GIF87a" || head6 === "GIF89a") return ".gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return ".webp";
  }
  return null;
}

function readHead(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const bytes = fs.readSync(fd, buffer, 0, 16, 0);
    return buffer.subarray(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

const collectFiles = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files || {}).flat();
};

const removeFiles = (files) => {
  for (const file of files) {
    try {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch {
      // best effort
    }
  }
};

/**
 * Runs after multer has written the temp files: verifies the actual content
 * is an image, then normalises `originalname` to the detected type (controllers derive the saved
 * extension from it).
 */
const verifyContent = (req, res, next) => {
  const files = collectFiles(req);
  try {
    for (const file of files) {
      const detected = detectImageType(readHead(file.path));
      if (!detected) {
        throw new Error("File content does not match an allowed image type");
      }
      // A real image with the wrong extension (e.g. a PNG named .jpg) is
      // accepted but saved under its true extension.
      const stem = file.originalname.slice(0, file.originalname.length - path.extname(file.originalname).length);
      file.originalname = `${stem}${detected}`;
    }
    return next();
  } catch (error) {
    removeFiles(files);
    return next(error);
  }
};

const instance = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Same API as a multer instance (`single`, `fields`, `array`), with the
// content check chained on, so routes need no changes.
const withVerification = (build) => (...args) => {
  const parse = build(...args);
  return (req, res, next) =>
    parse(req, res, (err) => {
      if (err) {
        removeFiles(collectFiles(req));
        return next(err);
      }
      return verifyContent(req, res, next);
    });
};

module.exports = {
  single: withVerification((...a) => instance.single(...a)),
  fields: withVerification((...a) => instance.fields(...a)),
  array: withVerification((...a) => instance.array(...a)),
  validateFilename,
  detectImageType,
};
