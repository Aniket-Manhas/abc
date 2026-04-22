const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST /api/analytics/crowd — Log a crowd reading
router.post('/crowd', (req, res) => {
  try {
    const { nodeId, nodeName, density, personCount, source, floor } = req.body;
    const stmt = db.prepare(`
      INSERT INTO crowd_history (node_id, node_name, density, person_count, source, floor)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nodeId, nodeName || nodeId, density, personCount || 0, source || 'simulated', floor || 0);
    
    // Update peak hours table
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const densityScore = density === 'high' ? 1.0 : density === 'medium' ? 0.5 : 0.0;
    
    db.prepare(`
      INSERT INTO peak_hours (node_id, hour, day_of_week, avg_density, sample_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(node_id, hour, day_of_week) DO UPDATE SET
        avg_density = (avg_density * sample_count + ?) / (sample_count + 1),
        sample_count = sample_count + 1,
        updated_at = datetime('now')
    `).run(nodeId, hour, dayOfWeek, densityScore, densityScore);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analytics/navigation — Log a navigation request
router.post('/navigation', (req, res) => {
  try {
    const { userId, sourceNode, destNode, pathNodes, totalDistance, estimatedTime, accessibilityMode, crowdAware } = req.body;
    const stmt = db.prepare(`
      INSERT INTO usage_logs (user_id, source_node, dest_node, path_nodes, total_distance, estimated_time, accessibility_mode, crowd_aware)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId || null,
      sourceNode, destNode,
      JSON.stringify(pathNodes || []),
      totalDistance || 0,
      estimatedTime || 0,
      accessibilityMode || 'none',
      crowdAware ? 1 : 0
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/crowd/history?nodeId=&hours=24 — Crowd history for chart
router.get('/crowd/history', (req, res) => {
  try {
    const { nodeId, hours = 24, limit = 200 } = req.query;
    let query, params;
    
    if (nodeId) {
      query = `SELECT * FROM crowd_history WHERE node_id = ? AND recorded_at >= datetime('now', '-${parseInt(hours)} hours') ORDER BY recorded_at DESC LIMIT ?`;
      params = [nodeId, parseInt(limit)];
    } else {
      query = `SELECT * FROM crowd_history WHERE recorded_at >= datetime('now', '-${parseInt(hours)} hours') ORDER BY recorded_at DESC LIMIT ?`;
      params = [parseInt(limit)];
    }
    
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/peak-hours?nodeId= — Get peak hour data for charts
router.get('/peak-hours', (req, res) => {
  try {
    const { nodeId } = req.query;
    let rows;
    
    if (nodeId) {
      rows = db.prepare('SELECT * FROM peak_hours WHERE node_id = ? ORDER BY day_of_week, hour').all(nodeId);
    } else {
      // Aggregate across all nodes, group by hour
      rows = db.prepare(`
        SELECT hour, day_of_week, AVG(avg_density) as avg_density, SUM(sample_count) as sample_count
        FROM peak_hours GROUP BY hour, day_of_week ORDER BY day_of_week, hour
      `).all();
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/popular-routes — Most requested routes
router.get('/popular-routes', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT source_node, dest_node, COUNT(*) as count, AVG(total_distance) as avg_distance, AVG(estimated_time) as avg_time
      FROM usage_logs GROUP BY source_node, dest_node ORDER BY count DESC LIMIT 10
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/usage-stats — Overall usage statistics
router.get('/usage-stats', (req, res) => {
  try {
    const today = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE logged_at >= date('now')").get();
    const total = db.prepare('SELECT COUNT(*) as count FROM usage_logs').get();
    const accessible = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE accessibility_mode != 'none'").get();
    const crowdAware = db.prepare('SELECT COUNT(*) as count FROM usage_logs WHERE crowd_aware = 1').get();
    const avgDist = db.prepare('SELECT AVG(total_distance) as avg FROM usage_logs').get();
    
    const hourlyToday = db.prepare(`
      SELECT strftime('%H', logged_at) as hour, COUNT(*) as count
      FROM usage_logs WHERE logged_at >= date('now') GROUP BY hour ORDER BY hour
    `).all();

    res.json({
      todayNavigations: today.count,
      totalNavigations: total.count,
      accessibleNavigations: accessible.count,
      crowdAwareNavigations: crowdAware.count,
      avgDistance: Math.round(avgDist.avg || 0),
      hourlyToday
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/crowd/summary — Crowd summary by node right now
router.get('/crowd/summary', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT node_id, node_name,
             SUM(CASE WHEN density='high' THEN 1 ELSE 0 END) as high_count,
             SUM(CASE WHEN density='medium' THEN 1 ELSE 0 END) as medium_count,
             SUM(CASE WHEN density='low' THEN 1 ELSE 0 END) as low_count,
             COUNT(*) as total_readings,
             MAX(recorded_at) as last_seen
      FROM crowd_history GROUP BY node_id ORDER BY high_count DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/analytics/prune — Prune old data
router.delete('/prune', (req, res) => {
  try {
    const days = parseInt(process.env.DATA_RETENTION_DAYS) || 30;
    const result = db.prepare(
      `DELETE FROM crowd_history WHERE recorded_at < datetime('now', '-${days} days')`
    ).run();
    res.json({ deleted: result.changes, message: `Pruned records older than ${days} days` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
