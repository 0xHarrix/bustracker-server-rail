const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createRoute,
  listRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
  getCurrentRoute
} = require("./routes.controller");

const router = express.Router();

router.use(authenticate);
router.get("/current", authorize("driver", "parent"), getCurrentRoute);
router.use(authorize("admin"));
router.post("/", createRoute);
router.get("/", listRoutes);
router.get("/:id", getRouteById);
router.patch("/:id", updateRoute);
router.delete("/:id", deleteRoute);

module.exports = router;
