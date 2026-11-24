const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(__dirname, "..", "uploads", "complaints");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadComplaintImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
    callback(null, true);
  }
}).array("images", 5);

module.exports = (req, res, next) => {
  uploadComplaintImages(req, res, (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" ? 400 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
    next();
  });
};
