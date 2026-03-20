const Announcement = require("./announcement.model");
const User = require("../users/user.model");
const { notifyUsers } = require("../notifications/notification.service");
const { success, created, badRequest, notFound } = require("../../utils/response");

const createAnnouncement = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { title, message, targetRoles, expiresAt } = req.body;

    if (!title || !message) {
      return badRequest(res, "title and message are required.");
    }

    const announcement = await Announcement.create({
      schoolId,
      createdBy: userId,
      title: String(title).trim(),
      message: String(message).trim(),
      targetRoles: Array.isArray(targetRoles) && targetRoles.length > 0 ? targetRoles : ["parent"],
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    const recipients = await User.find({
      schoolId,
      role: { $in: announcement.targetRoles },
      isActive: true
    })
      .select("_id")
      .lean();

    await notifyUsers({
      schoolId,
      userIds: recipients.map((item) => item._id.toString()),
      title: `Announcement: ${announcement.title}`,
      message: announcement.message,
      type: "ANNOUNCEMENT",
      data: { announcementId: announcement._id.toString() }
    });

    return created(res, announcement, "Announcement published.");
  } catch (err) {
    console.error("Create announcement error:", err);
    return badRequest(res, "Failed to create announcement.");
  }
};

const listAnnouncements = async (req, res) => {
  try {
    const { schoolId, role } = req.user;
    const now = new Date();

    const filter = {
      schoolId,
      isActive: true,
      targetRoles: role
    };

    const items = await Announcement.find(filter)
      .or([{ expiresAt: null }, { expiresAt: { $gt: now } }])
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return success(res, items);
  } catch (err) {
    console.error("List announcements error:", err);
    return badRequest(res, "Failed to fetch announcements.");
  }
};

const adminListAnnouncements = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const items = await Announcement.find({ schoolId }).sort({ createdAt: -1 }).limit(200).lean();
    return success(res, items);
  } catch (err) {
    console.error("Admin list announcements error:", err);
    return badRequest(res, "Failed to fetch announcements.");
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const payload = {};
    if (req.body.title) payload.title = String(req.body.title).trim();
    if (req.body.message) payload.message = String(req.body.message).trim();
    if (req.body.targetRoles) payload.targetRoles = req.body.targetRoles;
    if (req.body.expiresAt !== undefined) payload.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (req.body.isActive !== undefined) payload.isActive = Boolean(req.body.isActive);

    const updated = await Announcement.findOneAndUpdate(
      { _id: id, schoolId },
      { $set: payload },
      { new: true }
    );

    if (!updated) return notFound(res, "Announcement not found.");
    return success(res, updated, "Announcement updated.");
  } catch (err) {
    console.error("Update announcement error:", err);
    return badRequest(res, "Failed to update announcement.");
  }
};

module.exports = {
  createAnnouncement,
  listAnnouncements,
  adminListAnnouncements,
  updateAnnouncement
};
