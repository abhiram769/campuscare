const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  getMyTasks, updateTaskStatus, getTodayAttendance, checkIn, checkOut, completeTaskWithEvidence
} = require("../controllers/staff.controller");
const uploadTaskEvidence = require("../middleware/taskEvidenceUpload.middleware");

router.use(protect, authorize("CLEANER"));
router.get("/tasks", getMyTasks);
router.patch("/tasks/:id/status", updateTaskStatus);
router.post("/tasks/:id/complete", uploadTaskEvidence, completeTaskWithEvidence);
router.get("/attendance/today", getTodayAttendance);
router.post("/attendance/check-in", checkIn);
router.post("/attendance/check-out", checkOut);

module.exports = router;
