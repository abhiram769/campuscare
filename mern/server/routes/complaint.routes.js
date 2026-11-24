const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const { createComplaint, getMyComplaints, getComplaintStats, getComplaintById } = require("../controllers/complaint.controller");
router.use(protect, authorize("STUDENT", "FACULTY"));
router.get("/stats", getComplaintStats);
router.get("/mine", getMyComplaints);
router.post("/", createComplaint);
router.get("/:id", getComplaintById);
module.exports = router;
