const Complaint = require("../models/Complaint");
const fs = require("fs");
const { perceptualHash } = require("../utils/perceptualHash");

exports.createComplaint = async (req, res, next) => {
  try {
    const { title, description, category, location, latitude, longitude, images } = req.body;
    if (!title || !description || !category || !location) {
      (req.files || []).forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ success: false, message: "Title, description, category and campus location are required." });
    }
    const serverBaseUrl = (process.env.SERVER_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const uploadedImages = (req.files || []).map((file) => `${serverBaseUrl}/uploads/complaints/${file.filename}`);
    const imageHashes = await Promise.all((req.files || []).map((file) => perceptualHash(file.path)));
    const legacyImages = Array.isArray(images) ? images.slice(0, Math.max(0, 5 - uploadedImages.length)) : [];
    let suspectedDuplicates = [];
    if (req.body.suspectedDuplicateIds) {
      try {
        const parsed = JSON.parse(req.body.suspectedDuplicateIds);
        if (Array.isArray(parsed)) suspectedDuplicates = parsed.filter((id) => /^[a-f0-9]{24}$/i.test(String(id))).slice(0, 5);
      } catch { /* Ignore malformed optional duplicate references. */ }
    }
    const complaint = await Complaint.create({
      reporter: req.user._id, title, description, category, location,
      latitude: latitude == null || latitude === "" ? undefined : Number(latitude),
      longitude: longitude == null || longitude === "" ? undefined : Number(longitude),
      images: [...uploadedImages, ...legacyImages],
      imageHashes,
      suspectedDuplicates,
      duplicateReview: suspectedDuplicates.length ? "PENDING" : "NOT_REQUIRED"
    });
    res.status(201).json({ success: true, message: "Complaint submitted.", complaint });
  } catch (error) {
    (req.files || []).forEach((file) => fs.unlink(file.path, () => {}));
    next(error);
  }
};
exports.getMyComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ reporter: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: complaints.length, complaints });
  } catch (error) { next(error); }
};
exports.getComplaintStats = async (req, res, next) => {
  try {
    const [total, open, completed] = await Promise.all([
      Complaint.countDocuments({ reporter: req.user._id }),
      Complaint.countDocuments({ reporter: req.user._id, status: { $nin: ["COMPLETED", "DUPLICATE"] } }),
      Complaint.countDocuments({ reporter: req.user._id, status: "COMPLETED" })
    ]);
    res.json({ success: true, stats: { total, open, completed } });
  } catch (error) { next(error); }
};
exports.getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, reporter: req.user._id });
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found." });
    res.json({ success: true, complaint });
  } catch (error) { next(error); }
};
