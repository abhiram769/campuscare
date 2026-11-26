const router = require("express").Router();
const { protect } = require("../middleware/auth.middleware");
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require("../controllers/notification.controller");

router.use(protect);
router.get("/", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

module.exports = router;
