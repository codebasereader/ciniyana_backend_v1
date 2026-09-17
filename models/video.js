const mongoose = require("mongoose");

const localizedString = {
  kn: { type: String, default: "" },
  en: { type: String, default: "" },
};

const videoSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
    },
    youtubeId: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    title: {
      kn: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    category: localizedString,
    body: localizedString,
    date: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
