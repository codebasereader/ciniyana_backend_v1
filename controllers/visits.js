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

function isoDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

exports.stats = async (req, res) => {
  try {
    const DAYS = 30;
    const sinceDate = isoDateDaysAgo(DAYS - 1);

    const [rows, totalAgg] = await Promise.all([
      Visit.find({ date: { $gte: sinceDate } })
        .select("date count -_id")
        .lean(),
      Visit.aggregate([{ $group: { _id: null, total: { $sum: "$count" } } }]),
    ]);

    const countsByDate = new Map(rows.map((row) => [row.date, row.count]));

    const daily = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = isoDateDaysAgo(i);
      daily.push({ date, count: countsByDate.get(date) || 0 });
    }

    const total = totalAgg[0]?.total || 0;

    return res.status(200).json({ total, daily });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch visit stats" });
  }
};
