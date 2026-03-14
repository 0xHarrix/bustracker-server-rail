const express = require("express");
const { login, me } = require("./auth.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Public
router.post("/login", login);

// Protected
router.get("/me", authenticate, me);

module.exports = router;
