const express = require('express');
const router = express.Router();
const CrowdReading = require('../models/CrowdReading');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/crowd/current — Get latest crowd density for all nodes
router.get('/current', async (req, res) => {
  try {
    const readings = await CrowdReading.getLatestAll();
    // Convert to map: { nodeId: reading }
    const crowdMap = {};
    readings.forEach(r => { crowdMap[r.nodeId] = r; });
    res.json(crowdMap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crowd/report — Camera/sensor reports crowd for a node
router.post('/report', protect, async (req, res) => {
  try {
    const { nodeId, nodeName, density, personCount, source } = req.body;
    const reading = await CrowdReading.create({
      nodeId, nodeName, density, personCount,
      source: source || 'simulated',
      floor: req.body.floor || 0
    });

    // Broadcast to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('crowd:update', { nodeId, density, personCount, timestamp: reading.timestamp });
    }

    // Also log to analytics server (fire-and-forget)
    const axios = require('../node_modules/axios') || null;
    try {
      const fetch = require('node-fetch').default || null;
    } catch (_) {}

    res.status(201).json(reading);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crowd/node/:nodeId — History for a node (last 50)
router.get('/node/:nodeId', protect, adminOnly, async (req, res) => {
  try {
    const readings = await CrowdReading.find({ nodeId: req.params.nodeId })
      .sort({ timestamp: -1 }).limit(50);
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
