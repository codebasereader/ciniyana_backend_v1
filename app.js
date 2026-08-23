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
const fs = require("fs");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

app.use(cors());

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

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const API_ROOT = "/";
app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, "assets")));
app.use(`${API_ROOT}images`, express.static(path.join(__dirname, "images")));
app.disable("etag");

const userRoutes = require("./routes/user");
const flashBackRoutes = require("./routes/flashback");
const remembranceRoutes = require("./routes/remembrance");
const infoSpecialRoutes = require("./routes/infoSpecial");
const photoStoryRoutes = require("./routes/photoStory");
const offTheCameraRoutes = require("./routes/offTheCamera");
const articleRoutes = require("./routes/article");
const filmTodayRoutes = require("./routes/filmToday");
const posterRoutes = require("./routes/poster");

app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}flashback`, flashBackRoutes);
app.use(`${API_ROOT}remembrance`, remembranceRoutes);
app.use(`${API_ROOT}info-special`, infoSpecialRoutes);
app.use(`${API_ROOT}photo-story`, photoStoryRoutes);
app.use(`${API_ROOT}off-the-camera`, offTheCameraRoutes);
app.use(`${API_ROOT}article`, articleRoutes);
app.use(`${API_ROOT}film-today`, filmTodayRoutes);
app.use(`${API_ROOT}poster`, posterRoutes);

app.use("/", (req, res) => {
  return res.status(200).send("Welcome!");
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

    server.listen(PORT, () => {
      console.log("DB Connection Successful");
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("Error in connecting to DB:", error);
  });
