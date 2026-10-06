const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const { auditMutations } = require("./utils/audit");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}

const builtinOrigins = [
  "https://www.planclothes.xyz",
  "https://planclothes.xyz",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const allowedOrigins = new Set([...builtinOrigins, ...envOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and configured origins.
      // Browsers omit the trailing slash on Origin, so strip it before comparing.
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    // Required for the browser to send/receive the httpOnly auth cookies
    // cross-origin (frontend and API run on different ports/domains).
    credentials: true,
  })
);

/* Make sure media upload folders exist before the first image/document write */
[
  "assets/temp_resources",
  "assets/documents",
  "assets/images/full/high_res",
  "assets/images/full/low_res",
  "assets/images/thumb/high_res",
  "assets/images/thumb/low_res",
  "images/temp",
  "images/flashback",
  "images/remembrance",
  "images/info-special",
  "images/photo-story",
  "images/off-the-camera",
  "images/article",
  "images/film-today",
  "images/poster",
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Behind Apache (reverse proxy) the real client IP arrives via
// X-Forwarded-For; without this every request looks like it comes from the
// proxy and rate limits are shared by all users.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    // This is a JSON/static-file API, so lock framing down completely.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

const API_ROOT = "/api/";
// Uploaded files are served as inert, never-sniffed static content.
const staticOptions = {
  dotfiles: "deny",
  index: false,
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
};
app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, "assets"), staticOptions));
app.use(`${API_ROOT}images`, express.static(path.join(__dirname, "images"), staticOptions));
app.disable("etag");

// General per-IP ceiling for the whole API (login has its own, stricter one).
app.use(
  API_ROOT,
  rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_PER_MIN || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please slow down" },
  })
);

const visitRoutes = require("./routes/visits");
const statsRoutes = require("./routes/stats");
const userRoutes = require("./routes/user");
const flashBackRoutes = require("./routes/flashback");
const remembranceRoutes = require("./routes/remembrance");
const infoSpecialRoutes = require("./routes/infoSpecial");
const photoStoryRoutes = require("./routes/photoStory");
const offTheCameraRoutes = require("./routes/offTheCamera");
const articleRoutes = require("./routes/article");
const filmTodayRoutes = require("./routes/filmToday");
const posterRoutes = require("./routes/poster");
const videoRoutes = require("./routes/video");

app.use(`${API_ROOT}visits`, visitRoutes);
app.use(`${API_ROOT}stats`, statsRoutes);
app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}flashback`, auditMutations("flashback"), flashBackRoutes);
app.use(`${API_ROOT}remembrance`, auditMutations("remembrance"), remembranceRoutes);
app.use(`${API_ROOT}info-special`, auditMutations("info-special"), infoSpecialRoutes);
app.use(`${API_ROOT}photo-story`, auditMutations("photo-story"), photoStoryRoutes);
app.use(`${API_ROOT}off-the-camera`, auditMutations("off-the-camera"), offTheCameraRoutes);
app.use(`${API_ROOT}article`, auditMutations("article"), articleRoutes);
app.use(`${API_ROOT}film-today`, auditMutations("film-today"), filmTodayRoutes);
app.use(`${API_ROOT}poster`, auditMutations("poster"), posterRoutes);
app.use(`${API_ROOT}video`, auditMutations("video"), videoRoutes);

app.use("/", (req, res) => {
  return res.status(200).send("Welcome!");
});

app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Not allowed by CORS" });
  }
  // Malformed JSON / oversized body are client errors, not server faults.
  if (err && (err.type === "entity.parse.failed" || err.type === "entity.too.large")) {
    return res.status(err.status || 400).json({ message: "Invalid request body" });
  }
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

const DB_URL = process.env.DB_URL;
const PORT = process.env.PORT || 3000;

mongoose
  .connect(DB_URL)
  .then(async () => {
    const FlashBack = require("./models/flashback");
    const missingOrder = await FlashBack.find({
      $or: [{ order: { $exists: false } }, { order: null }],
    }).sort({ createdAt: 1 });

    if (missingOrder.length > 0) {
      const maxDoc = await FlashBack.findOne({ order: { $exists: true, $ne: null } })
        .sort({ order: -1 })
        .select("order");
      let next = typeof maxDoc?.order === "number" ? maxDoc.order + 1 : 0;
      for (const doc of missingOrder) {
        doc.order = next++;
        await doc.save();
      }
    }

    // LISTEN_HOST=127.0.0.1 keeps Node reachable only through the reverse
    // proxy. Unset = all interfaces (previous behaviour).
    const listenArgs = process.env.LISTEN_HOST ? [PORT, process.env.LISTEN_HOST] : [PORT];
    server.listen(...listenArgs, () => {
      console.log("DB Connection Successful");
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("Error in connecting to DB:", error);
  });
