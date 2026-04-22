const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'emergency', 'route_change', 'congestion'], default: 'info' },
  targetRole: { type: String, enum: ['all', 'passenger', 'admin'], default: 'all' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  affectedNodes: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
