const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

require("dotenv").config();

const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

app.use(cors());

/* Make sure media upload folders exist before the first image/document write */
[
  "assets/temp_resources",
  "assets/documents",
  "assets/images/full/high_res",
  "assets/images/full/low_res",
  "assets/images/thumb/high_res",
  "assets/images/thumb/low_res",
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
app.disable("etag");

const userRoutes = require("./routes/user");

app.use(`${API_ROOT}user`, userRoutes);

app.use("/", (req, res) => {
  return res.status(200).send("Welcome!");
});

const DB_URL = process.env.DB_URL;
const PORT = process.env.PORT || 3000;

mongoose
  .connect(DB_URL)
  .then(() => {
    server.listen(PORT, () => {
      console.log("DB Connection Successful");
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("Error in connecting to DB:", error);
  });
