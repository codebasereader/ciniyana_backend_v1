const mongoose = require("mongoose");

const localizedString = {
  kn: { type: String, default: "" },
  en: { type: String, default: "" },
};

const galleryItemSchema = new mongoose.Schema(
  {
    src: { type: String, required: true },
    caption: localizedString,
  },
  { _id: false }
);

const photoStorySchema = new mongoose.Schema(
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
    date: {
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
    body: {
      kn: { type: String, required: true },
      en: { type: String, required: true },
    },
    category: localizedString,
    gallery: {
      type: [galleryItemSchema],
      default: [],
    },
    photoCredit: localizedString,
    courtesy: localizedString,
    layout: {
      type: String,
      enum: ["landscape", "banner", "poster"],
      default: "landscape",
    },
    galleryMode: {
      type: String,
      enum: ["carousel", "stack", "interleave"],
      default: "stack",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhotoStory", photoStorySchema);
