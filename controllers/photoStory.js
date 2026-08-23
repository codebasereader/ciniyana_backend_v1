const fs = require("fs");
const path = require("path");
const PhotoStory = require("../models/photoStory");

const PHOTO_STORY_ROOT = path.join(__dirname, "..", "images", "photo-story");
const LAYOUTS = ["landscape", "banner", "poster"];
const GALLERY_MODES = ["carousel", "stack", "interleave"];

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
    gallery: Array.isArray(obj.gallery)
      ? obj.gallery.map((item) => ({
          src: item.src || "",
          caption: {
            kn: item.caption?.kn || "",
            en: item.caption?.en || "",
          },
        }))
      : [],
    photoCredit: {
      kn: obj.photoCredit?.kn || "",
      en: obj.photoCredit?.en || "",
    },
    courtesy: {
      kn: obj.courtesy?.kn || "",
      en: obj.courtesy?.en || "",
    },
    layout: obj.layout || "landscape",
    galleryMode: obj.galleryMode || "stack",
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

const removePostFolder = (postId) => {
  const dir = path.join(PHOTO_STORY_ROOT, String(postId));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const safeExt = (name) => {
  const ext = path.extname(name || "").toLowerCase() || ".jpg";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".jpg";
};

const cleanupTemp = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

const cleanupTemps = (files = []) => {
  for (const file of files) cleanupTemp(file);
};

const getUploaded = (req) => ({
  hero: req.files?.image?.[0] || null,
  galleryFiles: req.files?.gallery || [],
});

const mapBodyFields = (body) => {
  const layout = String(body.layout || "landscape").trim();
  const galleryMode = String(body.galleryMode || "stack").trim();

  return {
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
    courtesy: {
      kn: (body.courtesyKn || "").trim(),
      en: (body.courtesyEn || "").trim(),
    },
    layout: LAYOUTS.includes(layout) ? layout : "landscape",
    galleryMode: GALLERY_MODES.includes(galleryMode) ? galleryMode : "stack",
  };
};

const getNextOrder = async () => {
  const last = await PhotoStory.findOne().sort({ order: -1 }).select("order");
  return typeof last?.order === "number" ? last.order + 1 : 0;
};

const saveHeroImage = (postId, tempFile) => {
  const postDir = path.join(PHOTO_STORY_ROOT, String(postId));
  ensureDir(postDir);

  for (const file of fs.readdirSync(postDir)) {
    if (file.startsWith("hero.")) {
      fs.unlinkSync(path.join(postDir, file));
    }
  }

  const filename = `hero${safeExt(tempFile.originalname || tempFile.filename)}`;
  fs.renameSync(tempFile.path, path.join(postDir, filename));
  return `/images/photo-story/${postId}/${filename}`;
};

const resolveExistingGalleryFile = (postId, src) => {
  if (!src || typeof src !== "string") return null;
  const prefix = `/images/photo-story/${postId}/gallery/`;
  const at = src.indexOf(prefix);
  if (at === -1) return null;
  const filename = path.basename(src.slice(at + prefix.length));
  if (!filename || filename.includes("..")) return null;
  const full = path.join(PHOTO_STORY_ROOT, String(postId), "gallery", filename);
  return fs.existsSync(full) ? full : null;
};

const parseGalleryOrder = (raw) => {
  if (raw == null || raw === "") return [];
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) {
    throw new Error("galleryOrder must be a JSON array");
  }
  return parsed;
};

const rebuildGallery = (postId, galleryOrder, galleryFiles = []) => {
  const postDir = path.join(PHOTO_STORY_ROOT, String(postId));
  const galleryDir = path.join(postDir, "gallery");
  const stagingDir = path.join(postDir, `.gallery-staging-${Date.now()}`);

  ensureDir(postDir);
  ensureDir(stagingDir);

  const result = [];
  const usedIndexes = new Set();

  try {
    galleryOrder.forEach((item, index) => {
      const caption = {
        kn: (item.captionKn || "").trim(),
        en: (item.captionEn || "").trim(),
      };

      let sourcePath = null;
      let ext = ".jpg";

      if (item.kind === "existing") {
        sourcePath = resolveExistingGalleryFile(postId, item.src);
        if (!sourcePath) {
          throw new Error(`Existing gallery file not found: ${item.src || ""}`);
        }
        ext = path.extname(sourcePath).toLowerCase() || ".jpg";
      } else if (item.kind === "new") {
        const fileIndex = Number(item.fileIndex);
        if (
          !Number.isInteger(fileIndex) ||
          fileIndex < 0 ||
          fileIndex >= galleryFiles.length
        ) {
          throw new Error(`Invalid gallery fileIndex: ${item.fileIndex}`);
        }
        if (usedIndexes.has(fileIndex)) {
          throw new Error(`Duplicate gallery fileIndex: ${fileIndex}`);
        }
        usedIndexes.add(fileIndex);
        const file = galleryFiles[fileIndex];
        sourcePath = file.path;
        ext = safeExt(file.originalname || file.filename);
      } else {
        throw new Error(`Invalid galleryOrder kind: ${item.kind}`);
      }

      const filename = `${index}${ext}`;
      fs.copyFileSync(sourcePath, path.join(stagingDir, filename));
      result.push({
        src: `/images/photo-story/${postId}/gallery/${filename}`,
        caption,
      });
    });

    if (fs.existsSync(galleryDir)) {
      fs.rmSync(galleryDir, { recursive: true, force: true });
    }
    fs.renameSync(stagingDir, galleryDir);
  } catch (error) {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    throw error;
  }

  return result;
};

exports.list = async (req, res) => {
  try {
    const docs = await PhotoStory.find().sort({ order: 1 });
    return res.status(200).json({ posts: docs.map(toPost) });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to list photo story posts",
      error: error.message,
    });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const docs = await PhotoStory.find().sort({ order: 1 });
    const index = docs.findIndex((d) => d.slug === slug);

    if (index === -1) {
      return res.status(404).json({ message: "Photo Story post not found" });
    }

    const post = docs[index];
    const prev = index > 0 ? docs[index - 1] : null;
    const next = index < docs.length - 1 ? docs[index + 1] : null;
    const related = docs
      .filter((d) => String(d._id) !== String(post._id))
      .slice(0, 4);

    return res.status(200).json({
      post: toPost(post),
      prev: toPost(prev),
      next: toPost(next),
      related: related.map(toPost),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get photo story post",
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  const { hero, galleryFiles } = getUploaded(req);

  try {
    const fields = mapBodyFields(req.body);

    if (
      !fields.slug ||
      !fields.title.kn ||
      !fields.title.en ||
      !fields.body.kn ||
      !fields.body.en
    ) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(400).json({
        message: "slug, titleEn, titleKn, bodyEn and bodyKn are required",
      });
    }

    if (!hero) {
      cleanupTemps(galleryFiles);
      return res.status(400).json({ message: "image is required" });
    }

    let galleryOrder;
    try {
      galleryOrder = parseGalleryOrder(req.body.galleryOrder ?? "[]");
    } catch (parseError) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(400).json({ message: parseError.message });
    }

    const existing = await PhotoStory.findOne({ slug: fields.slug });
    if (existing) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(409).json({ message: "Slug already exists" });
    }

    const order = await getNextOrder();
    const post = await PhotoStory.create({
      ...fields,
      order,
      image: "",
      gallery: [],
    });

    try {
      ensureDir(path.join(PHOTO_STORY_ROOT, String(post._id)));
      post.image = saveHeroImage(post._id, hero);
      post.gallery = rebuildGallery(post._id, galleryOrder, galleryFiles);
      await post.save();
    } catch (uploadError) {
      await PhotoStory.findByIdAndDelete(post._id);
      removePostFolder(post._id);
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(500).json({
        message: "Server / upload error",
        error: uploadError.message,
      });
    }

    cleanupTemps(galleryFiles);

    return res.status(201).json({
      message: "Photo Story post created",
      post: toPost(post),
    });
  } catch (error) {
    cleanupTemp(hero);
    cleanupTemps(galleryFiles);
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
  const { hero, galleryFiles } = getUploaded(req);

  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(404).json({ message: "Photo Story post not found" });
    }

    const post = await PhotoStory.findById(req.params.id);
    if (!post) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(404).json({ message: "Photo Story post not found" });
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
      courtesyKn: req.body.courtesyKn ?? post.courtesy?.kn,
      courtesyEn: req.body.courtesyEn ?? post.courtesy?.en,
      layout: req.body.layout ?? post.layout,
      galleryMode: req.body.galleryMode ?? post.galleryMode,
    });

    if (
      !fields.slug ||
      !fields.title.kn ||
      !fields.title.en ||
      !fields.body.kn ||
      !fields.body.en
    ) {
      cleanupTemp(hero);
      cleanupTemps(galleryFiles);
      return res.status(400).json({ message: "Invalid payload" });
    }

    if (fields.slug !== post.slug) {
      const taken = await PhotoStory.findOne({
        slug: fields.slug,
        _id: { $ne: post._id },
      });
      if (taken) {
        cleanupTemp(hero);
        cleanupTemps(galleryFiles);
        return res.status(409).json({ message: "Slug taken by another post" });
      }
    }

    let galleryOrder = null;
    if (req.body.galleryOrder !== undefined) {
      try {
        galleryOrder = parseGalleryOrder(req.body.galleryOrder);
      } catch (parseError) {
        cleanupTemp(hero);
        cleanupTemps(galleryFiles);
        return res.status(400).json({ message: parseError.message });
      }
    }

    Object.assign(post, fields);

    if (hero) {
      try {
        post.image = saveHeroImage(post._id, hero);
      } catch (uploadError) {
        cleanupTemp(hero);
        cleanupTemps(galleryFiles);
        return res.status(500).json({
          message: "Server / upload error",
          error: uploadError.message,
        });
      }
    }

    if (galleryOrder !== null) {
      try {
        post.gallery = rebuildGallery(post._id, galleryOrder, galleryFiles);
      } catch (galleryError) {
        cleanupTemps(galleryFiles);
        return res.status(400).json({ message: galleryError.message });
      }
    }

    await post.save();
    cleanupTemps(galleryFiles);

    return res.status(200).json({
      message: "Photo Story post updated",
      post: toPost(post),
    });
  } catch (error) {
    cleanupTemp(hero);
    cleanupTemps(galleryFiles);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug taken by another post" });
    }
    return res.status(500).json({
      message: "Failed to update photo story post",
      error: error.message,
    });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "Photo Story post not found" });
    }

    const post = await PhotoStory.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Photo Story post not found" });
    }

    await PhotoStory.findByIdAndDelete(post._id);
    removePostFolder(post._id);

    return res.status(200).json({
      message: "Photo Story post deleted",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete photo story post",
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

    const allPosts = await PhotoStory.find().select("_id");
    const allIds = allPosts.map((p) => String(p._id)).sort();
    const incomingSorted = [...uniqueIds].sort();

    if (
      allIds.length !== incomingSorted.length ||
      allIds.some((id, i) => id !== incomingSorted[i])
    ) {
      return res.status(400).json({
        message:
          "orderedIds must include every photo story post id exactly once",
      });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        PhotoStory.findByIdAndUpdate(id, { order: index })
      )
    );

    const posts = await PhotoStory.find().sort({ order: 1 });

    return res.status(200).json({
      message: "Photo Story order updated",
      posts: posts.map(toPost),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to reorder photo story posts",
      error: error.message,
    });
  }
};
