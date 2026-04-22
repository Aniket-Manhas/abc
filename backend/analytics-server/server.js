require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const analyticsRoutes = require('./routes/analytics');

const app = express();

const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
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
app.listen(PORT, () => {
  console.log(`\n📊 Sahyatri Analytics Server running on port ${PORT}`);
  console.log(`📈 API: http://localhost:${PORT}/api/analytics\n`);
});
