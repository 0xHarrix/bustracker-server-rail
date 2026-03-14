const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/users.routes");
const schoolRoutes = require("./modules/schools/schools.routes");
const busRoutes = require("./modules/buses/buses.routes");
const tripRoutes = require("./modules/trips/trips.routes");
const { errorHandler } = require("./middlewares/error.middleware");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", time: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/trips", tripRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
