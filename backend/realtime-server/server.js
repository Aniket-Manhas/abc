require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const setupSockets = require('./sockets/crowdSocket');

// Routes
const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const crowdRoutes = require('./routes/crowd');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

const configuredOrigins = (process.env.SOCKET_CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultAllowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);
const allowedOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?$/;
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
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Sahyatri Realtime Server',
  timestamp: new Date().toISOString()
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/crowd', crowdRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve station GeoJSON statically
const path = require('path');
app.use('/geo', express.static(path.join(__dirname, '../../GeoResources/station')));

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Setup WebSocket handlers
setupSockets(io);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB, then start server
connectDB().then(async () => {
  // Create default admin if not exists
  const User = require('./models/User');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sahyatri.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    await User.create({
      name: 'Station Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });
    console.log(`✅ Default admin created: ${adminEmail} / ${adminPassword}`);
  }

  server.listen(PORT, () => {
    console.log(`\n🚂 Sahyatri Realtime Server running on port ${PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log(`🗺️  GeoJSON: http://localhost:${PORT}/geo\n`);
  });
});
