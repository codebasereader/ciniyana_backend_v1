const mongoose = require("mongoose");

const posterSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    title: {
      kn: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    layout: {
      type: String,
      enum: ["poster", "landscape", "banner"],
      default: "poster",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Poster", posterSchema);
