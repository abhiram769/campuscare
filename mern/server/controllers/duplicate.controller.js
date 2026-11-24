const fs = require("fs");
const path = require("path");
const Complaint = require("../models/Complaint");
const { perceptualHash, similarityPercent, distanceInMeters } = require("../utils/perceptualHash");

const WINDOW_HOURS = 2;
const LOCATION_RADIUS_METERS = 200;
const SIMILARITY_THRESHOLD = 85;
const uploadDirectory = path.join(__dirname, "..", "uploads", "complaints");

function localUploadPath(imageUrl) {
  try {
    const filename = path.basename(new URL(imageUrl).pathname);
    return path.join(uploadDirectory, filename);
  } catch {
    return null;
  }
}

exports.checkDuplicateImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    const hasCoordinates = req.body.latitude !== undefined && req.body.latitude !== ""
      && req.body.longitude !== undefined && req.body.longitude !== "";
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!files.length) {
      return res.json({ success: true, checked: false, matches: [], message: "Add at least one photo to check for similar reports." });
    }
    if (hasCoordinates && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      return res.status(400).json({ success: false, message: "The selected GPS coordinates are invalid." });
    }

    const incomingHashes = await Promise.all(files.map((file) => perceptualHash(file.path)));
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
    const candidates = await Complaint.find({
      createdAt: { $gte: since },
      status: { $nin: ["COMPLETED", "DUPLICATE"] },
      images: { $exists: true, $ne: [] }
    }).select("title location status createdAt latitude longitude imageHashes images");

    const matches = [];
    for (const candidate of candidates) {
      let distance = null;
      if (hasCoordinates && Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude)) {
        distance = distanceInMeters(latitude, longitude, candidate.latitude, candidate.longitude);
        if (distance > LOCATION_RADIUS_METERS) continue;
      } else if (hasCoordinates) {
        // If the existing report has no GPS coordinates, it cannot be confirmed as nearby.
        continue;
      }

      let savedHashes = candidate.imageHashes || [];
      // Backfill older reports created before image hashes were introduced.
      if (!savedHashes.length) {
        const imagePaths = (candidate.images || [])
          .map(localUploadPath)
          .filter((imagePath) => imagePath && fs.existsSync(imagePath));
        const generated = await Promise.all(imagePaths.map((imagePath) => perceptualHash(imagePath).catch(() => null)));
        savedHashes = generated.filter(Boolean);
        if (savedHashes.length) {
          await Complaint.updateOne({ _id: candidate._id }, { $set: { imageHashes: savedHashes } });
        }
      }

      let bestSimilarity = 0;
      for (const incomingHash of incomingHashes) {
        for (const savedHash of savedHashes) {
          bestSimilarity = Math.max(bestSimilarity, similarityPercent(incomingHash, savedHash));
        }
      }
      if (bestSimilarity >= SIMILARITY_THRESHOLD) {
        matches.push({
          complaintId: candidate._id,
          title: candidate.title,
          location: candidate.location,
          status: candidate.status,
          createdAt: candidate.createdAt,
          similarity: bestSimilarity,
          distanceMeters: distance === null ? null : Math.round(distance)
        });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    res.json({
      success: true,
      checked: true,
      locationChecked: hasCoordinates,
      matches: matches.slice(0, 5),
      rules: { timeWindowHours: WINDOW_HOURS, locationRadiusMeters: hasCoordinates ? LOCATION_RADIUS_METERS : null, similarityThreshold: SIMILARITY_THRESHOLD }
    });
  } catch (error) {
    next(error);
  } finally {
    (req.files || []).forEach((file) => fs.unlink(file.path, () => {}));
  }
};
