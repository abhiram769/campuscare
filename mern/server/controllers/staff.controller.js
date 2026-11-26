const Complaint = require("../models/Complaint");

exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Complaint.find({ assignedTo: req.user._id, status: { $nin: ["COMPLETED", "DUPLICATE"] } })
      .populate("reporter", "firstName lastName role")
      .sort({ createdAt: -1 });
    return res.json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    console.error("Cleaner task list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load assigned tasks." });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const allowed = {
      ACCEPTED: ["ASSIGNED"],
      IN_PROGRESS: ["ACCEPTED"],
      COMPLETED: ["IN_PROGRESS"]
    };
    const { status } = req.body;
    if (!allowed[status]) return res.status(400).json({ success: false, message: "Invalid task status." });
    const complaint = await Complaint.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!complaint) return res.status(404).json({ success: false, message: "Assigned task not found." });
    if (!allowed[status].includes(complaint.status)) {
      return res.status(409).json({ success: false, message: "This task cannot move to that status yet." });
    }
    complaint.status = status;
    if (status === "COMPLETED") complaint.resolvedAt = new Date();
    await complaint.save();
    return res.json({ success: true, message: "Task status updated.", task: complaint });
  } catch (error) {
    console.error("Cleaner task update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update task." });
  }
};
