const fs = require("fs");
const path = require("path");
const Complaint = require("../models/Complaint");
const Attendance = require("../models/Attendance");

const campusDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Complaint.find({ assignedTo: req.user._id, status: { $nin: ["COMPLETED", "DUPLICATE"] } })
      .populate("reporter", "firstName lastName role").sort({ createdAt: -1 });
    return res.json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    console.error("Cleaner task list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load assigned tasks." });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const allowed = { ACCEPTED: ["ASSIGNED"], IN_PROGRESS: ["ACCEPTED"] };
    const { status } = req.body;
    if (!allowed[status]) return res.status(400).json({ success: false, message: "Use the evidence submission action to complete a task." });
    const complaint = await Complaint.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!complaint) return res.status(404).json({ success: false, message: "Assigned task not found." });
    if (!allowed[status].includes(complaint.status)) return res.status(409).json({ success: false, message: "This task cannot move to that status yet." });
    complaint.status = status;
    await complaint.save();
    return res.json({ success: true, message: "Task status updated.", task: complaint });
  } catch (error) {
    console.error("Cleaner task update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update task." });
  }
};

exports.getTodayAttendance = async (req, res) => {
  try {
    const parts = campusDateParts();
    const isSunday = parts.weekday === "Sunday";
    const attendance = isSunday ? null : await Attendance.findOne({ cleaner: req.user._id, date: parts.year + "-" + parts.month + "-" + parts.day });
    return res.json({ success: true, attendance, isWorkingDay: !isSunday, dutyStart: "08:00", dutyEnd: "17:00", graceMinutes: 0 });
  } catch (error) {
    console.error("Attendance lookup error:", error);
    return res.status(500).json({ success: false, message: "Unable to load today's attendance." });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const now = new Date();
    const parts = campusDateParts(now);
    if (parts.weekday === "Sunday") return res.status(400).json({ success: false, message: "Sunday is not a scheduled working day." });
    const date = parts.year + "-" + parts.month + "-" + parts.day;
    const localClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    const isLate = localClock > "08:00";
    const existing = await Attendance.findOne({ cleaner: req.user._id, date });
    if (existing?.checkIn) return res.status(409).json({ success: false, message: "You have already checked in today.", attendance: existing });
    const attendance = existing || new Attendance({ cleaner: req.user._id, date });
    attendance.checkIn = now;
    attendance.status = isLate ? "LATE" : "PRESENT";
    await attendance.save();
    return res.status(200).json({ success: true, message: isLate ? "Checked in. Attendance marked late (no grace period)." : "Attendance marked present.", attendance });
  } catch (error) {
    console.error("Attendance check-in error:", error);
    return res.status(500).json({ success: false, message: "Unable to record check-in." });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const parts = campusDateParts();
    if (parts.weekday === "Sunday") return res.status(400).json({ success: false, message: "Sunday is not a scheduled working day." });
    const date = parts.year + "-" + parts.month + "-" + parts.day;
    const attendance = await Attendance.findOne({ cleaner: req.user._id, date });
    if (!attendance?.checkIn) return res.status(409).json({ success: false, message: "Check in before checking out." });
    if (attendance.checkOut) return res.status(409).json({ success: false, message: "You have already checked out today." });
    attendance.checkOut = new Date();
    await attendance.save();
    return res.json({ success: true, message: "Checked out successfully.", attendance });
  } catch (error) {
    console.error("Attendance check-out error:", error);
    return res.status(500).json({ success: false, message: "Unable to record check-out." });
  }
};

exports.completeTaskWithEvidence = async (req, res) => {
  const files = req.files || [];
  const removeUploads = () => files.forEach((file) => fs.unlink(file.path, () => {}));
  try {
    if (files.length === 0) return res.status(400).json({ success: false, message: "Upload at least one completion evidence photo." });
    const complaint = await Complaint.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!complaint) { removeUploads(); return res.status(404).json({ success: false, message: "Assigned task not found." }); }
    if (complaint.status !== "IN_PROGRESS") { removeUploads(); return res.status(409).json({ success: false, message: "Only an in-progress task can be completed." }); }
    const baseUrl = (process.env.SERVER_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    complaint.completionEvidence = files.map((file) => `${baseUrl}/uploads/task-evidence/${path.basename(file.path)}`);
    complaint.status = "COMPLETED";
    complaint.resolvedAt = new Date();
    await complaint.save();
    return res.json({ success: true, message: "Task completed. Evidence uploaded successfully.", task: complaint });
  } catch (error) {
    removeUploads();
    console.error("Task completion evidence error:", error);
    return res.status(500).json({ success: false, message: "Unable to complete task with evidence." });
  }
};
