const jwt = require('jsonwebtoken');
const User = require('../models/User');

const setupSockets = (io) => {
  // Middleware: authenticate socket connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          socket.user = user;
          socket.userId = user._id.toString();
        }
      }
    } catch (err) {
      // Allow unauthenticated connections for public crowd data
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (${socket.user?.name || 'anonymous'})`);

    // Join role-specific rooms
    if (socket.user?.role === 'admin') {
      socket.join('admins');
      console.log(`👑 Admin ${socket.user.name} joined admins room`);
    } else if (socket.user) {
      socket.join(`user:${socket.userId}`);
    }

    // ── USER EVENTS ─────────────────────────────────────────

    // User updates their location
    socket.on('user:location', (data) => {
      if (!socket.user) return;
      // Broadcast to admins for tracking
      io.to('admins').emit('user:location_update', {
        userId: socket.userId,
        userName: socket.user.name,
        ...data
      });
    });

    // User reports crowd from camera
    socket.on('crowd:camera_report', async (data) => {
      const CrowdReading = require('../models/CrowdReading');
      try {
        const reading = await CrowdReading.create({
          nodeId: data.nodeId,
          nodeName: data.nodeName,
          density: data.density,
          personCount: data.personCount,
          source: 'camera',
          floor: data.floor || 0
        });
        io.emit('crowd:update', { [data.nodeId]: { density: data.density, personCount: data.personCount, timestamp: reading.timestamp } });
      } catch (err) {
        console.error('Camera crowd report error:', err.message);
      }
    });

    // ── ADMIN EVENTS ─────────────────────────────────────────

    // Admin sends notification to users
    socket.on('admin:broadcast', (data) => {
      if (socket.user?.role !== 'admin') return;
      io.emit('notification:receive', {
        ...data,
        sentBy: socket.user.name,
        timestamp: new Date()
      });
    });

    // Admin resolves alert via socket
    socket.on('alert:resolve', async (alertId) => {
      if (socket.user?.role !== 'admin') return;
      const Alert = require('../models/Alert');
      try {
        const alert = await Alert.findByIdAndUpdate(
          alertId,
          { status: 'resolved', resolvedBy: socket.user._id, resolvedAt: new Date() },
          { new: true }
        );
        io.to('admins').emit('alert:updated', alert);
      } catch (err) {
        console.error('Alert resolve error:', err.message);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupSockets;
