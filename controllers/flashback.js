const fs = require("fs");
const path = require("path");
const FlashBack = require("../models/flashback");

const FLASHBACK_ROOT = path.join(__dirname, "..", "images", "flashback");

const toPost = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    slug: obj.slug,
    image: obj.image || "",
    date: obj.date || "",
    order: typeof obj.order === "number" ? obj.order : 0,
    title: {
      kn: obj.title?.kn || "",
      en: obj.title?.en || "",
    },
    body: {
      kn: obj.body?.kn || "",
      en: obj.body?.en || "",
    },
    category: {
      kn: obj.category?.kn || "",
      en: obj.category?.en || "",
    },
    photoCredit: {
      kn: obj.photoCredit?.kn || "",
      en: obj.photoCredit?.en || "",
    },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const normalizeSlug = (slug) =>
  String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const clearDirFiles = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, file));
  }
};

const removePostFolder = (postId) => {
  const dir = path.join(FLASHBACK_ROOT, String(postId));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const saveHeroImage = (postId, tempFile) => {
  const ext =
    path.extname(tempFile.originalname || tempFile.filename).toLowerCase() ||
    ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
    ? ext === ".jpeg"
      ? ".jpg"
      : ext
    : ".jpg";

  const postDir = path.join(FLASHBACK_ROOT, String(postId));
  ensureDir(postDir);
  clearDirFiles(postDir);

  const filename = `hero${safeExt}`;
  const dest = path.join(postDir, filename);
  fs.renameSync(tempFile.path, dest);

  return `/images/flashback/${postId}/${filename}`;
};

const cleanupTemp = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

const mapBodyFields = (body) => ({
  slug: normalizeSlug(body.slug),
  date: body.date || "",
  title: {
    kn: (body.titleKn || "").trim(),
    en: (body.titleEn || "").trim(),
  },
  body: {
    kn: body.bodyKn || "",
    en: body.bodyEn || "",
  },
  category: {
    kn: (body.categoryKn || "").trim(),
    en: (body.categoryEn || "").trim(),
  },
  photoCredit: {
    kn: (body.photoCreditKn || "").trim(),
    en: (body.photoCreditEn || "").trim(),
  },
});

const getNextOrder = async () => {
  const last = await FlashBack.findOne().sort({ order: -1 }).select("order");
  return typeof last?.order === "number" ? last.order + 1 : 0;
};

exports.list = async (req, res) => {
  try {
    const docs = await FlashBack.find().sort({ order: 1 });
    return res.status(200).json({
      posts: docs.map(toPost),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to list flash back posts",
      error: error.message,
    });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const docs = await FlashBack.find().sort({ order: 1 });
    const index = docs.findIndex((d) => d.slug === slug);

    if (index === -1) {
      return res.status(404).json({ message: "Flash back post not found" });
    }

    const post = docs[index];
    const prev = index > 0 ? docs[index - 1] : null;
    const next = index < docs.length - 1 ? docs[index + 1] : null;
    const related = docs
      .filter((d) => String(d._id) !== String(post._id))
      .slice(0, 3);

    return res.status(200).json({
      post: toPost(post),
      prev: toPost(prev),
      next: toPost(next),
      related: related.map(toPost),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get flash back post",
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const fields = mapBodyFields(req.body);

    if (
      !fields.slug ||
      !fields.title.kn ||
      !fields.title.en ||
      !fields.body.kn ||
      !fields.body.en
    ) {
      cleanupTemp(req.file);
      return res.status(400).json({
        message: "slug, titleEn, titleKn, bodyEn and bodyKn are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "image is required" });
    }

    const existing = await FlashBack.findOne({ slug: fields.slug });
    if (existing) {
      cleanupTemp(req.file);
      return res.status(409).json({ message: "Slug already exists" });
    }

    const order = await getNextOrder();

    const post = await FlashBack.create({
      ...fields,
      order,
      image: "",
    });

    try {
      ensureDir(path.join(FLASHBACK_ROOT, String(post._id)));
      post.image = saveHeroImage(post._id, req.file);
      await post.save();
    } catch (uploadError) {
      await FlashBack.findByIdAndDelete(post._id);
      removePostFolder(post._id);
      cleanupTemp(req.file);
      return res.status(500).json({
        message: "Server / upload error",
        error: uploadError.message,
      });
    }

    return res.status(201).json({
      message: "Flash back post created",
      post: toPost(post),
    });
  } catch (error) {
    cleanupTemp(req.file);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug already exists" });
    }
    return res.status(500).json({
      message: "Server / upload error",
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      cleanupTemp(req.file);
      return res.status(404).json({ message: "Flash back post not found" });
    }

    const post = await FlashBack.findById(req.params.id);
    if (!post) {
      cleanupTemp(req.file);
      return res.status(404).json({ message: "Flash back post not found" });
    }

    const fields = mapBodyFields({
      slug: req.body.slug ?? post.slug,
      date: req.body.date ?? post.date,
      titleKn: req.body.titleKn ?? post.title.kn,
      titleEn: req.body.titleEn ?? post.title.en,
      bodyKn: req.body.bodyKn ?? post.body.kn,
      bodyEn: req.body.bodyEn ?? post.body.en,
      categoryKn: req.body.categoryKn ?? post.category?.kn,
      categoryEn: req.body.categoryEn ?? post.category?.en,
      photoCreditKn: req.body.photoCreditKn ?? post.photoCredit?.kn,
      photoCreditEn: req.body.photoCreditEn ?? post.photoCredit?.en,
    });

    if (
      !fields.slug ||
      !fields.title.kn ||
      !fields.title.en ||
      !fields.body.kn ||
      !fields.body.en
    ) {
      cleanupTemp(req.file);
      return res.status(400).json({ message: "Invalid payload" });
    }

    if (fields.slug !== post.slug) {
      const taken = await FlashBack.findOne({
        slug: fields.slug,
        _id: { $ne: post._id },
      });
      if (taken) {
        cleanupTemp(req.file);
        return res.status(409).json({ message: "Slug taken by another post" });
      }
    }

    // Keep existing order — reorder endpoint owns sort position
    Object.assign(post, fields);

    if (req.file) {
      try {
        post.image = saveHeroImage(post._id, req.file);
      } catch (uploadError) {
        cleanupTemp(req.file);
        return res.status(500).json({
          message: "Server / upload error",
          error: uploadError.message,
        });
      }
    }

    await post.save();

    return res.status(200).json({
      message: "Flash back post updated",
      post: toPost(post),
    });
  } catch (error) {
    cleanupTemp(req.file);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug taken by another post" });
    }
    return res.status(500).json({
      message: "Failed to update flash back post",
      error: error.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "Flash back post not found" });
    }

    const post = await FlashBack.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Flash back post not found" });
    }

    await FlashBack.findByIdAndDelete(post._id);
    removePostFolder(post._id);

    return res.status(200).json({
      message: "Flash back post deleted",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete flash back post",
      error: error.message,
    });
  }
};

exports.reorder = async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({
        message: "orderedIds must be a non-empty array",
      });
    }

    const uniqueIds = [...new Set(orderedIds.map(String))];
    if (uniqueIds.length !== orderedIds.length) {
      return res.status(400).json({
        message: "orderedIds must not contain duplicates",
      });
    }

    const allPosts = await FlashBack.find().select("_id");
    const allIds = allPosts.map((p) => String(p._id)).sort();
    const incomingSorted = [...uniqueIds].sort();

    if (
      allIds.length !== incomingSorted.length ||
      allIds.some((id, i) => id !== incomingSorted[i])
    ) {
      return res.status(400).json({
        message: "orderedIds must include every flash back post id exactly once",
      });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        FlashBack.findByIdAndUpdate(id, { order: index })
      )
    );

    const posts = await FlashBack.find().sort({ order: 1 });

    return res.status(200).json({
      message: "Flash back order updated",
      posts: posts.map(toPost),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to reorder flash back posts",
      error: error.message,
    });
  }
};
