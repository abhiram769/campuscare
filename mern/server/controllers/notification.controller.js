const mongoose = require("mongoose");
const Notification = require("../models/Notification");

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate("complaint", "title status")
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
    return res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Notification list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID." });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id, readAt: null },
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      const existing = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
      if (!existing) return res.status(404).json({ success: false, message: "Notification not found." });
      return res.json({ success: true, notification: existing });
    }
    return res.json({ success: true, notification });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { readAt: new Date() }
    );
    return res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({ success: false, message: "Unable to update notifications." });
  }
};
