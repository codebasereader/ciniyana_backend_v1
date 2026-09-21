const Video = require("../models/video");

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const extractYoutubeId = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch (error) {
    try {
      url = new URL(`https://${rawUrl.trim()}`);
    } catch (innerError) {
      return null;
    }
  }

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  let candidate = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments[0] === "embed" || segments[0] === "shorts") {
        candidate = segments[1] || null;
      }
    }
  }

  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null;
};

const deriveThumbnail = (youtubeId) =>
  `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

const toPost = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    slug: obj.slug,
    order: typeof obj.order === "number" ? obj.order : 0,
    youtubeUrl: obj.youtubeUrl || "",
    youtubeId: obj.youtubeId || "",
    image: obj.image || "",
    title: {
      kn: obj.title?.kn || "",
      en: obj.title?.en || "",
    },
    category: {
      kn: obj.category?.kn || "",
      en: obj.category?.en || "",
    },
    body: {
      kn: obj.body?.kn || "",
      en: obj.body?.en || "",
    },
    date: obj.date || "",
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

const mapBodyFields = (body) => {
  const titleEn = (body.titleEn || "").trim();
  const titleKn = (body.titleKn || "").trim();
  const slugSource = body.slug || titleEn;

  return {
    slug: normalizeSlug(slugSource),
    youtubeUrl: (body.youtubeUrl || "").trim(),
    title: {
      kn: titleKn,
      en: titleEn,
    },
    category: {
      kn: (body.categoryKn || "").trim(),
      en: (body.categoryEn || "").trim(),
    },
    body: {
      kn: body.bodyKn || "",
      en: body.bodyEn || "",
    },
    date: body.date || "",
  };
};

const getNextOrder = async () => {
  const last = await Video.findOne().sort({ order: -1 }).select("order");
  return typeof last?.order === "number" ? last.order + 1 : 0;
};

const uniqueSlug = async (baseSlug, excludeId = null) => {
  let slug = baseSlug || "video";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Video.findOne(query).select("_id");
    if (!exists) return candidate;
    suffix += 1;
  }
};

exports.list = async (req, res) => {
  try {
    const docs = await Video.find().sort({ order: 1 });
    return res.status(200).json({ posts: docs.map(toPost) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to list video posts",
    });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const docs = await Video.find().sort({ order: 1 });
    const index = docs.findIndex((d) => d.slug === slug);

    if (index === -1) {
      return res.status(404).json({ message: "Video post not found" });
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
    console.error(error);
    return res.status(500).json({
      message: "Failed to get video post",
    });
  }
};

exports.create = async (req, res) => {
  try {
    const fields = mapBodyFields(req.body);

    if (!fields.title.kn || !fields.title.en) {
      return res.status(400).json({
        message: "titleEn and titleKn are required",
      });
    }

    if (!fields.youtubeUrl) {
      return res.status(400).json({ message: "youtubeUrl is required" });
    }

    const youtubeId = extractYoutubeId(fields.youtubeUrl);
    if (!youtubeId) {
      return res.status(400).json({
        message: "youtubeUrl does not resolve to a valid video id",
      });
    }

    if (!fields.slug) {
      return res.status(400).json({
        message: "Could not generate slug from titleEn",
      });
    }

    // If client sent an explicit slug that already exists → 409
    // If slug was auto from titleEn, append a short suffix instead
    const clientSentSlug = Boolean(req.body.slug);
    if (clientSentSlug) {
      const existing = await Video.findOne({ slug: fields.slug });
      if (existing) {
        return res.status(409).json({ message: "Slug already exists" });
      }
    } else {
      fields.slug = await uniqueSlug(fields.slug);
    }

    const order = await getNextOrder();
    const post = await Video.create({
      slug: fields.slug,
      youtubeUrl: fields.youtubeUrl,
      youtubeId,
      image: deriveThumbnail(youtubeId),
      title: fields.title,
      category: fields.category,
      body: fields.body,
      date: fields.date,
      order,
    });

    return res.status(201).json({
      message: "Video post created",
      post: toPost(post),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug already exists" });
    }
    console.error(error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

exports.update = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "Video post not found" });
    }

    const post = await Video.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Video post not found" });
    }

    const fields = mapBodyFields({
      slug: req.body.slug ?? post.slug,
      youtubeUrl: req.body.youtubeUrl ?? post.youtubeUrl,
      titleKn: req.body.titleKn ?? post.title.kn,
      titleEn: req.body.titleEn ?? post.title.en,
      categoryKn: req.body.categoryKn ?? post.category?.kn,
      categoryEn: req.body.categoryEn ?? post.category?.en,
      bodyKn: req.body.bodyKn ?? post.body?.kn,
      bodyEn: req.body.bodyEn ?? post.body?.en,
      date: req.body.date ?? post.date,
    });

    if (!fields.title.kn || !fields.title.en) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    if (!fields.youtubeUrl) {
      return res.status(400).json({ message: "youtubeUrl is required" });
    }

    if (fields.youtubeUrl !== post.youtubeUrl) {
      const youtubeId = extractYoutubeId(fields.youtubeUrl);
      if (!youtubeId) {
        return res.status(400).json({
          message: "youtubeUrl does not resolve to a valid video id",
        });
      }
      post.youtubeUrl = fields.youtubeUrl;
      post.youtubeId = youtubeId;
      post.image = deriveThumbnail(youtubeId);
    }

    if (!fields.slug) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // Only change slug when the client sends one; otherwise keep existing
    if (req.body.slug !== undefined && fields.slug !== post.slug) {
      const taken = await Video.findOne({
        slug: fields.slug,
        _id: { $ne: post._id },
      });
      if (taken) {
        return res.status(409).json({ message: "Slug taken by another post" });
      }
      post.slug = fields.slug;
    }

    post.title = fields.title;
    post.category = fields.category;
    post.body = fields.body;
    post.date = fields.date;

    // Keep existing order — reorder endpoint owns sort position
    await post.save();

    return res.status(200).json({
      message: "Video post updated",
      post: toPost(post),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug taken by another post" });
    }
    console.error(error);
    return res.status(500).json({
      message: "Failed to update video post",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "Video post not found" });
    }

    const post = await Video.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Video post not found" });
    }

    return res.status(200).json({ message: "Video post deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to delete video post",
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

    const allPosts = await Video.find().select("_id");
    const allIds = allPosts.map((p) => String(p._id)).sort();
    const incomingSorted = [...uniqueIds].sort();

    if (
      allIds.length !== incomingSorted.length ||
      allIds.some((id, i) => id !== incomingSorted[i])
    ) {
      return res.status(400).json({
        message: "orderedIds must include every video post id exactly once",
      });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        Video.findByIdAndUpdate(id, { order: index })
      )
    );

    const posts = await Video.find().sort({ order: 1 });

    return res.status(200).json({
      message: "Video order updated",
      posts: posts.map(toPost),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to reorder video posts",
    });
  }
};
