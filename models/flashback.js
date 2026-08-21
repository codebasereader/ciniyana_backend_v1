const mongoose = require("mongoose");

const localizedString = {
  kn: { type: String, default: "" },
  en: { type: String, default: "" },
};

const flashBackSchema = new mongoose.Schema(
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
    photoCredit: localizedString,
  },
  { timestamps: true }
);

module.exports = mongoose.model("FlashBack", flashBackSchema);
