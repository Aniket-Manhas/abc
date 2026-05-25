const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST /api/analytics/crowd — Log a crowd reading
router.post('/crowd', async (req, res) => {
  try {
    const { nodeId, nodeName, density, personCount, source, floor } = req.body;
    const result = await db.runAsync(`
      INSERT INTO crowd_history (node_id, node_name, density, person_count, source, floor)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nodeId, nodeName || nodeId, density, personCount || 0, source || 'simulated', floor || 0]);
    
    // Update peak hours table
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const densityScore = density === 'high' ? 1.0 : density === 'medium' ? 0.5 : 0.0;
    
    await db.runAsync(`
      INSERT INTO peak_hours (node_id, hour, day_of_week, avg_density, sample_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(node_id, hour, day_of_week) DO UPDATE SET
        avg_density = (peak_hours.avg_density * peak_hours.sample_count + ?) / (peak_hours.sample_count + 1),
        sample_count = peak_hours.sample_count + 1,
        updated_at = datetime('now')
    `, [nodeId, hour, dayOfWeek, densityScore, densityScore]);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analytics/navigation — Log a navigation request
router.post('/navigation', async (req, res) => {
  try {
    const { userId, sourceNode, destNode, pathNodes, totalDistance, estimatedTime, accessibilityMode, crowdAware } = req.body;
    const result = await db.runAsync(`
      INSERT INTO usage_logs (user_id, source_node, dest_node, path_nodes, total_distance, estimated_time, accessibility_mode, crowd_aware)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId || null,
      sourceNode, destNode,
      JSON.stringify(pathNodes || []),
      totalDistance || 0,
      estimatedTime || 0,
      accessibilityMode || 'none',
      crowdAware ? 1 : 0
    ]);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/crowd/history?nodeId=&hours=24 — Crowd history for chart
router.get('/crowd/history', async (req, res) => {
  try {
    const { nodeId, hours = 24, limit = 200 } = req.query;
    let rows;
    
    if (nodeId) {
      rows = await db.allAsync(
        `SELECT * FROM crowd_history WHERE node_id = ? AND recorded_at >= datetime('now', '-${parseInt(hours)} hours') ORDER BY recorded_at DESC LIMIT ?`,
        [nodeId, parseInt(limit)]
      );
    } else {
      rows = await db.allAsync(
        `SELECT * FROM crowd_history WHERE recorded_at >= datetime('now', '-${parseInt(hours)} hours') ORDER BY recorded_at DESC LIMIT ?`,
        [parseInt(limit)]
      );
    }
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/peak-hours?nodeId= — Get peak hour data for charts
router.get('/peak-hours', async (req, res) => {
  try {
    const { nodeId } = req.query;
    let rows;
    
    if (nodeId) {
      rows = await db.allAsync('SELECT * FROM peak_hours WHERE node_id = ? ORDER BY day_of_week, hour', [nodeId]);
    } else {
      rows = await db.allAsync(`
        SELECT hour, day_of_week, AVG(avg_density) as avg_density, SUM(sample_count) as sample_count
        FROM peak_hours GROUP BY hour, day_of_week ORDER BY day_of_week, hour
      `);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/popular-routes — Most requested routes
router.get('/popular-routes', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT source_node, dest_node, COUNT(*) as count, AVG(total_distance) as avg_distance, AVG(estimated_time) as avg_time
      FROM usage_logs GROUP BY source_node, dest_node ORDER BY count DESC LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/usage-stats — Overall usage statistics
router.get('/usage-stats', async (req, res) => {
  try {
    const [today, total, accessible, crowdAware, avgDist, hourlyToday] = await Promise.all([
      db.getAsync("SELECT COUNT(*) as count FROM usage_logs WHERE logged_at >= date('now')"),
      db.getAsync("SELECT COUNT(*) as count FROM usage_logs"),
      db.getAsync("SELECT COUNT(*) as count FROM usage_logs WHERE accessibility_mode != 'none'"),
      db.getAsync("SELECT COUNT(*) as count FROM usage_logs WHERE crowd_aware = 1"),
      db.getAsync("SELECT AVG(total_distance) as avg FROM usage_logs"),
      db.allAsync(`
        SELECT EXTRACT(HOUR FROM logged_at) as hour, COUNT(*) as count
        FROM usage_logs WHERE logged_at >= date('now') GROUP BY hour ORDER BY hour
      `.replace(/EXTRACT\(HOUR FROM logged_at\)/g, db.isPostgres ? 'EXTRACT(HOUR FROM logged_at)' : "strftime('%H', logged_at)"))
    ]);

    res.json({
      todayNavigations: parseInt(today?.count || 0),
      totalNavigations: parseInt(total?.count || 0),
      accessibleNavigations: parseInt(accessible?.count || 0),
      crowdAwareNavigations: parseInt(crowdAware?.count || 0),
      avgDistance: Math.round(parseFloat(avgDist?.avg || 0)),
      hourlyToday
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/crowd/summary — Crowd summary by node right now
router.get('/crowd/summary', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT node_id, node_name,
             SUM(CASE WHEN density='high' THEN 1 ELSE 0 END) as high_count,
             SUM(CASE WHEN density='medium' THEN 1 ELSE 0 END) as medium_count,
             SUM(CASE WHEN density='low' THEN 1 ELSE 0 END) as low_count,
             COUNT(*) as total_readings,
             MAX(recorded_at) as last_seen
      FROM crowd_history GROUP BY node_id ORDER BY high_count DESC
    `);
    // ensure pg count fields are numbers
    const formattedRows = rows.map(r => ({
      ...r,
      high_count: parseInt(r.high_count || 0),
      medium_count: parseInt(r.medium_count || 0),
      low_count: parseInt(r.low_count || 0),
      total_readings: parseInt(r.total_readings || 0)
    }));
    res.json(formattedRows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/analytics/prune — Prune old data
router.delete('/prune', async (req, res) => {
  try {
    const days = parseInt(process.env.DATA_RETENTION_DAYS) || 30;
    const result = await db.runAsync(`DELETE FROM crowd_history WHERE recorded_at < datetime('now', '-${days} days')`);
    res.json({ deleted: result.changes, message: `Pruned records older than ${days} days` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;xports = router;
