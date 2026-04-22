const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || './sahyatri_analytics.db';
const db = new Database(path.resolve(dbPath));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ── Create Tables ────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS crowd_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    node_name TEXT NOT NULL,
    density TEXT CHECK(density IN ('low','medium','high')) NOT NULL,
    person_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'simulated',
    floor INTEGER DEFAULT 0,
    recorded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_crowd_node ON crowd_history(node_id);
  CREATE INDEX IF NOT EXISTS idx_crowd_time ON crowd_history(recorded_at);

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    source_node TEXT NOT NULL,
    dest_node TEXT NOT NULL,
    path_nodes TEXT,
    total_distance REAL,
    estimated_time INTEGER,
    accessibility_mode TEXT DEFAULT 'none',
    crowd_aware INTEGER DEFAULT 0,
    logged_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs(logged_at);

  CREATE TABLE IF NOT EXISTS peak_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    hour INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    avg_density REAL DEFAULT 0,
    sample_count INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(node_id, hour, day_of_week)
  );
`);

console.log('✅ SQLite database initialized');

module.exports = db;
