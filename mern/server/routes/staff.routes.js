const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const notifyAfter = require("../middleware/notificationHooks");
const {
  getMyTasks, getMyCompletedTasks, updateTaskStatus, getTodayAttendance, checkIn, checkOut, completeTaskWithEvidence
} = require("../controllers/staff.controller");
const uploadTaskEvidence = require("../middleware/taskEvidenceUpload.middleware");

router.use(protect, authorize("CLEANER"));
router.get("/tasks", getMyTasks);
router.get("/tasks/completed", getMyCompletedTasks);
router.patch("/tasks/:id/status", notifyAfter("status", updateTaskStatus));
router.post("/tasks/:id/complete", uploadTaskEvidence, notifyAfter("completed", completeTaskWithEvidence));
router.get("/attendance/today", getTodayAttendance);
router.post("/attendance/check-in", checkIn);
router.post("/attendance/check-out", checkOut);

module.exports = router;
