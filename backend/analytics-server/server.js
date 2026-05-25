require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const analyticsRoutes = require('./routes/analytics');

const app = express();

const allowedOriginsStr = process.env.CORS_ORIGIN || process.env.SOCKET_CORS_ORIGIN || '';
const configuredOrigins = allowedOriginsStr.split(',').map(s => s.trim()).filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?$/.test(origin);
};

app.use(cors({ 
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  }, 
  credentials: true 
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Sahyatri Analytics Server',
  timestamp: new Date().toISOString()
}));

app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n📊 Sahyatri Analytics Server running on port ${PORT}`);
  console.log(`📈 API: http://localhost:${PORT}/api/analytics\n`);
});
