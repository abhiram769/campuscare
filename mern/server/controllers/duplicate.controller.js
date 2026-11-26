const fs = require("fs");
const Complaint = require("../models/Complaint");
const { perceptualHash, similarityPercent, distanceInMeters } = require("../utils/perceptualHash");

const WINDOW_HOURS = 2;
const LOCATION_RADIUS_METERS = 200;
const SIMILARITY_THRESHOLD = 85;

exports.checkDuplicateImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!files.length) {
      return res.json({ success: true, checked: false, matches: [], message: "Add at least one photo to check for similar reports." });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      files.forEach((file) => fs.unlink(file.path, () => {}));
      return res.json({ success: true, checked: false, matches: [], message: "Select a map location to check nearby reports." });
    }

    const incomingHashes = await Promise.all(files.map((file) => perceptualHash(file.path)));
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
    const candidates = await Complaint.find({
      createdAt: { $gte: since },
      status: { $nin: ["COMPLETED", "DUPLICATE"] },
      latitude: { $exists: true },
      longitude: { $exists: true },
      imageHashes: { $exists: true, $ne: [] }
    }).select("title location status createdAt latitude longitude imageHashes");

    const matches = [];
    for (const candidate of candidates) {
      const distance = distanceInMeters(latitude, longitude, candidate.latitude, candidate.longitude);
      if (distance > LOCATION_RADIUS_METERS) continue;
      let bestSimilarity = 0;
      for (const incomingHash of incomingHashes) {
        for (const savedHash of candidate.imageHashes || []) {
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
          distanceMeters: Math.round(distance)
        });
      }
    }
    matches.sort((a, b) => b.similarity - a.similarity);
    res.json({
      success: true,
      checked: true,
      matches: matches.slice(0, 5),
      rules: { timeWindowHours: WINDOW_HOURS, locationRadiusMeters: LOCATION_RADIUS_METERS, similarityThreshold: SIMILARITY_THRESHOLD }
    });
  } catch (error) {
    next(error);
  } finally {
    (req.files || []).forEach((file) => fs.unlink(file.path, () => {}));
  }
};
