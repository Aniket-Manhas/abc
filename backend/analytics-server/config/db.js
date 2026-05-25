const path = require('path');

class DBAdapter {
  constructor() {
    this.isPostgres = !!process.env.DATABASE_URL;
    
    if (this.isPostgres) {
      const { Pool } = require('pg');
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      console.log('✅ PostgreSQL (pg) database initialized');
    } else {
      const Database = require('better-sqlite3');
      const dbPath = process.env.SQLITE_DB_PATH || './sahyatri_analytics.db';
      this.db = new Database(path.resolve(dbPath));
      this.db.pragma('journal_mode = WAL');
      console.log('✅ SQLite database initialized');
    }
  }

  // Convert SQLite parameterized query (?) to PostgreSQL parameterized query ($1, $2)
  _convertQuery(sql) {
    if (!this.isPostgres) return sql;
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  // Run initial schema creation
  async initSchema() {
    if (this.isPostgres) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS crowd_history (
          id SERIAL PRIMARY KEY,
          node_id TEXT NOT NULL,
          node_name TEXT NOT NULL,
          density TEXT CHECK(density IN ('low','medium','high')) NOT NULL,
          person_count INTEGER DEFAULT 0,
          source TEXT DEFAULT 'simulated',
          floor INTEGER DEFAULT 0,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_crowd_node ON crowd_history(node_id);
        CREATE INDEX IF NOT EXISTS idx_crowd_time ON crowd_history(recorded_at);

        CREATE TABLE IF NOT EXISTS usage_logs (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          source_node TEXT NOT NULL,
          dest_node TEXT NOT NULL,
          path_nodes TEXT,
          total_distance REAL,
          estimated_time INTEGER,
          accessibility_mode TEXT DEFAULT 'none',
          crowd_aware INTEGER DEFAULT 0,
          logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs(logged_at);

        CREATE TABLE IF NOT EXISTS peak_hours (
          id SERIAL PRIMARY KEY,
          node_id TEXT NOT NULL,
          hour INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL,
          avg_density REAL DEFAULT 0,
          sample_count INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(node_id, hour, day_of_week)
        );
      `);
    } else {
      this.db.exec(`
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
    }
  }

  // Unified interface for routes
  prepare(sql) {
    const pgSql = this._convertQuery(sql);
    
    return {
      run: (...params) => {
        if (this.isPostgres) {
          // PG doesn't return lastInsertRowid natively unless RETURNING is used, 
          // but we will mock a basic response to prevent errors in existing routes.
          let query = pgSql;
          // SQLite ON CONFLICT DO UPDATE -> PG ON CONFLICT DO UPDATE
          // Actually PG's ON CONFLICT is almost identical syntax, but handles datetime differently.
          query = query.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
          
          // Hacky way to inject RETURNING id if it looks like an INSERT
          if (query.trim().toUpperCase().startsWith('INSERT') && !query.includes('ON CONFLICT')) {
             query += ' RETURNING id';
          }

          // Use sync wrapper logic if needed, but since we are modifying routes to be async... wait, we shouldn't modify all routes if possible.
          // Better-sqlite3 is synchronous. PG is asynchronous. We need to handle this.
          throw new Error("PG requires async/await. Routes must be updated to await db queries.");
        } else {
           return this.db.prepare(sql).run(...params);
        }
      },
      get: (...params) => {
        if (this.isPostgres) throw new Error("PG requires async");
        return this.db.prepare(sql).get(...params);
      },
      all: (...params) => {
        if (this.isPostgres) throw new Error("PG requires async");
        return this.db.prepare(sql).all(...params);
      }
    };
  }

  // Proper async API for routes to use
  async runAsync(sql, params = []) {
    if (this.isPostgres) {
      let query = this._convertQuery(sql).replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP').replace(/date\('now'\)/g, 'CURRENT_DATE');
      if (query.trim().toUpperCase().startsWith('INSERT') && !query.toUpperCase().includes('RETURNING')) {
         query += ' RETURNING id';
      }
      // handle sqlite ON CONFLICT sqlite vs pg syntax
      if (query.includes('ON CONFLICT') && query.includes('DO UPDATE SET')) {
          // pg requires the target columns in ON CONFLICT (col1, col2) - our query has ON CONFLICT(node_id, hour, day_of_week)
          // SQLite and PG syntax are the same here!
      }
      const res = await this.pool.query(query, params);
      return { lastInsertRowid: res.rows[0]?.id || 0, changes: res.rowCount };
    } else {
      const res = this.db.prepare(sql).run(...params);
      return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
    }
  }

  async getAsync(sql, params = []) {
    if (this.isPostgres) {
      const query = this._convertQuery(sql).replace(/date\('now'\)/g, 'CURRENT_DATE');
      const res = await this.pool.query(query, params);
      return res.rows[0];
    } else {
      return this.db.prepare(sql).get(...params);
    }
  }

  async allAsync(sql, params = []) {
    if (this.isPostgres) {
      const query = this._convertQuery(sql).replace(/datetime\('now', '-(.*?) hours'\)/g, "NOW() - INTERVAL '$1 hours'").replace(/datetime\('now', '-(.*?) days'\)/g, "NOW() - INTERVAL '$1 days'");
      const res = await this.pool.query(query, params);
      return res.rows;
    } else {
      return this.db.prepare(sql).all(...params);
    }
  }
}

const db = new DBAdapter();
db.initSchema().catch(console.error);

module.exports = db;
