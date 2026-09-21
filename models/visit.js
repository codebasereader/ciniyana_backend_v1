const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    date: {
      type: String, // "YYYY-MM-DD", UTC calendar day
      required: true,
      unique: true,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
