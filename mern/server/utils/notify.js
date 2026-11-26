const User = require("../models/User");
const Notification = require("../models/Notification");
const { emitToUser } = require("./realtime");

async function notify({ userIds = [], roles = [], complaintId = null, type, title, message }) {
  try {
    const ids = new Set(userIds.filter(Boolean).map((id) => id.toString()));
    if (roles.length) {
      const users = await User.find({ role: { $in: roles }, isActive: true }).select("_id");
      users.forEach((user) => ids.add(user._id.toString()));
    }
    if (!ids.size) return;

    const records = await Notification.insertMany([...ids].map((recipient) => ({
      recipient,
      complaint: complaintId,
      type,
      title,
      message
    })));

    records.forEach((record) => emitToUser(record.recipient, record.toObject()));
  } catch (error) {
    // Notification delivery must never cause the underlying complaint action to fail.
    console.error("Notification delivery error:", error.message);
  }
}

module.exports = notify;
