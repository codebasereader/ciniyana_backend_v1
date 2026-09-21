const Visit = require("../models/visit");

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

exports.track = async (req, res) => {
  try {
    await Visit.findOneAndUpdate(
      { date: todayUTC() },
      { $inc: { count: 1 } },
      { upsert: true }
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to record visit" });
  }
};
