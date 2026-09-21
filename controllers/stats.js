const FlashBack = require("../models/flashback");
const Remembrance = require("../models/remembrance");
const InfoSpecial = require("../models/infoSpecial");
const PhotoStory = require("../models/photoStory");
const OffTheCamera = require("../models/offTheCamera");
const Article = require("../models/article");
const FilmToday = require("../models/filmToday");
const Poster = require("../models/poster");
const Video = require("../models/video");

const MENUS = [
  { key: "flashback", label: "Flash Back", Model: FlashBack },
  { key: "remembrance", label: "Remembrance", Model: Remembrance },
  { key: "info-special", label: "Info Special", Model: InfoSpecial },
  { key: "photo-story", label: "Photo Story", Model: PhotoStory },
  { key: "off-the-camera", label: "Off The Camera", Model: OffTheCamera },
  { key: "article", label: "Article", Model: Article },
  { key: "film-today", label: "Film Today", Model: FilmToday },
  { key: "poster", label: "Poster", Model: Poster },
  { key: "video", label: "Video", Model: Video },
];

exports.posts = async (req, res) => {
  try {
    const menus = await Promise.all(
      MENUS.map(async ({ key, label, Model }) => {
        const [count, latest] = await Promise.all([
          Model.countDocuments(),
          Model.findOne().sort({ updatedAt: -1 }).select("updatedAt").lean(),
        ]);
        return {
          key,
          label,
          count,
          lastUpdatedAt: latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : null,
        };
      })
    );

    const total = menus.reduce((sum, menu) => sum + menu.count, 0);

    return res.status(200).json({ total, menus });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch post stats" });
  }
};
