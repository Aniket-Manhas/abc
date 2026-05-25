const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/alerts/panic — Passenger triggers panic
router.post('/panic', protect, async (req, res) => {
  try {
    const {
      nodeId,
      nodeName,
      lat,
      lng,
      floor,
      accuracy,
      locationSource,
      message,
      type,
    } = req.body;

    const location = {
      nodeId: nodeId || 'unknown',
      nodeName: nodeName || 'Unknown location',
      locationSource: locationSource || (lat != null && lng != null ? 'gps' : 'landmark'),
    };

    if (lat != null && lng != null) {
      location.lat = Number(lat);
      location.lng = Number(lng);
    }
    if (floor != null && floor !== undefined && floor !== '') {
      location.floor = Number(floor);
    }
    if (accuracy != null && accuracy !== undefined) {
      location.accuracy = Number(accuracy);
    }

    const alert = await Alert.create({
      type: type || 'panic',
      userId: req.user._id,
      userName: req.user.name,
      userPhone: req.user.phone || '',
      location,
      message: message || 'Emergency! Need help immediately.'
    });

    // Emit via socket (io is attached to req.app)
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('alert:new', alert);
    }

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alerts — Admin: get all alerts
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = status ? { status } : {};
    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alerts/active — Admin: get active alerts
router.get('/active', protect, adminOnly, async (req, res) => {
  try {
    const alerts = await Alert.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/acknowledge — Admin
router.put('/:id/acknowledge', protect, adminOnly, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged', acknowledgedBy: req.user._id },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const io = req.app.get('io');
    if (io) io.to('admins').emit('alert:updated', alert);

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/resolve — Admin
router.put('/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedBy: req.user._id, resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const io = req.app.get('io');
    if (io) io.to('admins').emit('alert:updated', alert);

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alerts/my — Passenger: get own alerts
router.get('/my', protect, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
