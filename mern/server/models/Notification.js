const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  complaint: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
  type: { type: String, enum: ["COMPLAINT_SUBMITTED", "TASK_ASSIGNED", "TASK_ACCEPTED", "TASK_STARTED", "TASK_COMPLETED"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);
