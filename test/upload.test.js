const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const upload = require("../middleware/upload");

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

test("validateFilename", () => {
  assert.strictEqual(upload.validateFilename("Raj goroor hunsur.jpg"), null);
  assert.strictEqual(upload.validateFilename("Photo.01.jpg"), null);
  assert.strictEqual(upload.validateFilename("IMG.PNG"), null);
  assert.ok(upload.validateFilename("shell.php.jpg"));
  assert.ok(upload.validateFilename("a.jpg.png"));
  assert.ok(upload.validateFilename("a.html.webp"));
  assert.ok(upload.validateFilename("shell.php"));
  assert.ok(upload.validateFilename("a.jpg\0.php"));
  assert.ok(upload.validateFilename("noext"));
});

test("detectImageType", () => {
  assert.strictEqual(upload.detectImageType(JPEG), ".jpg");
  assert.strictEqual(upload.detectImageType(PNG), ".png");
  assert.strictEqual(upload.detectImageType(Buffer.from("<?php echo 1;")), null);
});

async function post(name, mime, data) {
  const app = express();
  app.post("/", upload.single("image"), (req, res) => {
    const saved = req.file.originalname;
    fs.unlinkSync(req.file.path);
    res.json({ saved });
  });
  app.use((err, req, res, next) => res.status(400).json({ message: err.message }));
  const server = app.listen(0);
  try {
    const form = new FormData();
    form.append("image", new Blob([data], { type: mime }), name);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: "POST", body: form });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test("upload endpoint behaviour", async () => {
  assert.strictEqual((await post("a.jpg", "image/jpeg", JPEG)).status, 200);
  assert.strictEqual((await post("shell.php.jpg", "image/jpeg", JPEG)).status, 400);
  assert.strictEqual((await post("x.php", "image/png", JPEG)).status, 400);
  assert.strictEqual((await post("fake.jpg", "image/jpeg", Buffer.from("<?php system($_GET[1]);"))).status, 400);
  const renamed = await post("shot.jpg", "image/jpeg", PNG);
  assert.strictEqual(renamed.status, 200);
  assert.strictEqual(renamed.body.saved, "shot.png");
});
