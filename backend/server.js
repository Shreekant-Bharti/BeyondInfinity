"use strict";

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const path = require("path");
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db/mongoose");
const { seedAdmin } = require("./db/seedAdmin");
const tankRoutes = require("./routes/tankRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const TankController = require("./controllers/tankController");
const logger = require("./utils/logger");

const FRONTEND_DIR = path.join(__dirname, "..");
const PORT = process.env.PORT || 3000;

const CORS_OPTIONS = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID", "X-API-Key"],
  optionsSuccessStatus: 200,
};

const app = express();

function listenWithFallback(startPort, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    const tryListen = (port, attempt) => {
      const server = app.listen(port, () => resolve({ server, port }));

      server.once("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attempt < maxAttempts) {
          logger.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
          return tryListen(port + 1, attempt + 1);
        }
        reject(err);
      });
    };

    tryListen(Number(startPort), 1);
  });
}

app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, _res, next) => {
  logger.api(req.method, req.originalUrl, {
    ip: req.ip,
    contentType: req.headers["content-type"] || "none",
  });
  next();
});

const reportRoutes = require("./routes/reportRoutes");

app.get("/health", TankController.health);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", tankRoutes);
app.use("/api", reportRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(FRONTEND_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("/data", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "data.html"));
});

app.use((req, res) => {
  logger.warn(`404 — Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 404,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    success: false,
    error: "Internal server error. Check server logs for details.",
    code: 500,
  });
});

(async () => {
  await connectDB();
  await seedAdmin();

  const { server, port } = await listenWithFallback(PORT);

  logger.success(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.success(`  Water Tank Monitoring — ONLINE`);
  logger.success(`  Dashboard   →  http://localhost:${port}`);
  logger.success(`  Data Viewer →  http://localhost:${port}/data`);
  logger.success(`  Health      →  http://localhost:${port}/health`);
  logger.success(`  API root    →  http://localhost:${port}/api`);
  logger.success(`  Auth        →  http://localhost:${port}/api/auth`);
  logger.success(`  Admin       →  http://localhost:${port}/api/admin`);
  logger.success(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  server.on("error", (err) => {
    logger.error("HTTP server error", err);
    process.exit(1);
  });

  function gracefulShutdown(signal) {
    logger.warn(`${signal} received — initiating graceful shutdown…`);
    server.close(() => {
      logger.success("HTTP server closed. Exiting process.");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Graceful shutdown timeout. Forcing exit.");
      process.exit(1);
    }, 5000);
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection", { reason: String(reason) });
    process.exit(1);
  });
})().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});

module.exports = app;
