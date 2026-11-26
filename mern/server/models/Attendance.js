const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  cleaner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true },
  checkIn: { type: Date, default: null },
  checkOut: { type: Date, default: null },
  status: { type: String, enum: ["PRESENT", "LATE"], default: "PRESENT" }
}, { timestamps: true });

attendanceSchema.index({ cleaner: 1, date: 1 }, { unique: true });
module.exports = mongoose.model("Attendance", attendanceSchema);
