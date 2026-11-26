const notify = require("../utils/notify");
const Complaint = require("../models/Complaint");

function notifyAfter(event, handler) {
  return async (req, res, next) => {
    let responseBody = null;
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      responseBody = body;
      return sendJson(body);
    };

    res.once("finish", async () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !responseBody?.success) return;
      try {
        if (event === "created") {
          const complaint = responseBody.complaint;
          if (complaint) await notify({
            roles: ["ADMIN"],
            complaintId: complaint._id,
            type: "COMPLAINT_SUBMITTED",
            title: "New complaint submitted",
            message: `${complaint.title} was reported at ${complaint.location}.`
          });
        }

        if (event === "assigned") {
          const complaint = responseBody.complaint;
          if (complaint) await notify({
            userIds: [req.body.cleanerId],
            complaintId: complaint._id,
            type: "TASK_ASSIGNED",
            title: "New task assigned",
            message: `You have been assigned: ${complaint.title}.`
          });
        }

        if (event === "status") {
          const complaint = await Complaint.findById(req.params.id).select("reporter title");
          const status = req.body.status;
          if (complaint && status === "ACCEPTED") await notify({
            userIds: [complaint.reporter],
            complaintId: complaint._id,
            type: "TASK_ACCEPTED",
            title: "Cleaner accepted your complaint",
            message: `The cleaner has accepted "${complaint.title}" and will attend to it.`
          });
          if (complaint && status === "IN_PROGRESS") await notify({
            userIds: [complaint.reporter],
            complaintId: complaint._id,
            type: "TASK_STARTED",
            title: "Work has started",
            message: `The cleaner has started work on "${complaint.title}".`
          });
        }

        if (event === "completed") {
          const complaint = responseBody.task;
          if (complaint) await notify({
            userIds: [complaint.reporter],
            roles: ["ADMIN"],
            complaintId: complaint._id,
            type: "TASK_COMPLETED",
            title: "Complaint work completed",
            message: `The cleaner completed "${complaint.title}" and uploaded completion evidence.`
          });
        }
      } catch (error) {
        console.error("Post-action notification hook failed:", error.message);
      }
    });

    return handler(req, res, next);
  };
}

module.exports = notifyAfter;
