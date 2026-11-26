const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(__dirname, "..", "uploads", "task-evidence");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new Error("Evidence must be JPG, PNG or WEBP."));
    }
    callback(null, true);
  }
}).array("evidence", 5);

module.exports = (req, res, next) => upload(req, res, (error) => {
  if (error) return res.status(400).json({ success: false, message: error.message });
  next();
});
