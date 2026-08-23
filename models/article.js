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

const profileSchema = new mongoose.Schema(
  {
    image: { type: String, default: "" },
    name: localizedString,
    role: localizedString,
    intro: localizedString,
  },
  { _id: false }
);

const articleSchema = new mongoose.Schema(
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
    subtitle: {
      kn: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    body: {
      kn: { type: String, required: true },
      en: { type: String, required: true },
    },
    category: localizedString,
    profile: {
      type: profileSchema,
      default: null,
    },
    gallery: {
      type: [galleryItemSchema],
      default: [],
    },
    photoCredit: localizedString,
    courtesy: localizedString,
    layout: {
      type: String,
      enum: ["landscape", "banner", "poster", "overlap"],
      default: "landscape",
    },
    galleryMode: {
      type: String,
      enum: ["carousel", "stack", "interleave"],
      default: "interleave",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Article", articleSchema);
