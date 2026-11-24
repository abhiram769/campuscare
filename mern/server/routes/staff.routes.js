const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const { getMyTasks, updateTaskStatus } = require("../controllers/staff.controller");

router.use(protect, authorize("CLEANER"));
router.get("/tasks", getMyTasks);
router.patch("/tasks/:id/status", updateTaskStatus);

module.exports = router;
