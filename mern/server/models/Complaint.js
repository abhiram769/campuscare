const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: ["CLEANLINESS", "GARBAGE", "PLUMBING", "ELECTRICAL", "MAINTENANCE", "OTHER"], required: true },
  location: { type: String, required: true, trim: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
  status: { type: String, enum: ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DUPLICATE"], default: "SUBMITTED", index: true },
  images: [{ type: String }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

complaintSchema.index({ reporter: 1, createdAt: -1 });
module.exports = mongoose.model("Complaint", complaintSchema);
