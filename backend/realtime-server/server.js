require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const setupSockets = require("./sockets/crowdSocket");

// Routes
const authRoutes = require("./routes/auth");
const alertRoutes = require("./routes/alerts");
const crowdRoutes = require("./routes/crowd");
const notificationRoutes = require("./routes/notifications");

const app = express();
const server = http.createServer(app);

const configuredOrigins = (process.env.SOCKET_CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
];
const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...configuredOrigins,
]);
const allowedOriginPattern =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?$/;
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return allowedOriginPattern.test(origin);
};

// Socket.io
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io accessible in routes
app.set("io", io);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

// Health check
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "Sahyatri Realtime Server",
    timestamp: new Date().toISOString(),
  }),
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/crowd", crowdRoutes);
app.use("/api/notifications", notificationRoutes);

// Serve station GeoJSON statically
const path = require("path");
app.use(
  "/geo",
  express.static(path.join(__dirname, "../../GeoResources/station")),
);

// ── Email test endpoint (admin only, used to debug SMTP config) ──
app.get("/api/test-email", async (req, res) => {
  const sendEmail = require("./utils/mailer");
  const to = req.query.to || process.env.SMTP_USER;
  if (!to) return res.status(400).json({ message: "Provide ?to=email@example.com" });
  const result = await sendEmail({
    email: to,
    subject: "✅ Sahyatri Email Test",
    message: `This is a test email from Sahyatri server.\nSMTP Host: ${process.env.SMTP_HOST}\nSMTP Port: ${process.env.SMTP_PORT}\nSMTP User: ${process.env.SMTP_USER}\nTimestamp: ${new Date().toISOString()}`
  });
  res.json(result);
});


// 404 handler
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// Setup WebSocket handlers
setupSockets(io);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB (optional), then start server
connectDB()
  .then(async (isConnected) => {
    try {
      // Only create default admin if database is connected
      if (isConnected) {
        const User = require("./models/User");
        const adminEmail = process.env.ADMIN_EMAIL || "admin@sahyatri.com";
        const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

        const adminExists = await User.findOne({ email: adminEmail });
        if (!adminExists) {
          await User.create({
            name: "Station Admin",
            email: adminEmail,
            password: adminPassword,
            role: "admin",
          });
          console.log(
            `✅ Default admin created: ${adminEmail} / ${adminPassword}`,
          );
        }
      } else {
        console.log(`ℹ️  Skipping admin creation — database offline`);
      }
    } catch (err) {
      console.warn(`⚠️  Could not create default admin: ${err.message}`);
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`\n🚂 Sahyatri Realtime Server running on port ${PORT}`);
      console.log(`📡 WebSocket: ws://localhost:${PORT}`);
      console.log(`🌐 API: http://localhost:${PORT}/api`);
      console.log(`🗺️  GeoJSON: http://localhost:${PORT}/geo`);
      console.log(
        isConnected
          ? `✅ Database: Connected`
          : `⚠️  Database: Offline (fallback mode)\n`,
      );
    });
  })
  .catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
