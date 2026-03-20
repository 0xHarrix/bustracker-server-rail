const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createAnnouncement,
  listAnnouncements,
  adminListAnnouncements,
  updateAnnouncement
} = require("./announcements.controller");

const router = express.Router();

router.use(authenticate);
router.get("/", listAnnouncements);
router.get("/admin", authorize("admin"), adminListAnnouncements);
router.post("/", authorize("admin"), createAnnouncement);
router.patch("/:id", authorize("admin"), updateAnnouncement);

module.exports = router;
