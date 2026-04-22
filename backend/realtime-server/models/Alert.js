const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: { type: String, enum: ['panic', 'medical', 'fire', 'security', 'lost'], required: true },
  userId: { type: String, default: 'anonymous_user' },
  userName: { type: String, required: true },
  userPhone: { type: String, default: '' },
  location: {
    nodeId:   { type: String, default: 'unknown' },
    nodeName: { type: String, default: 'Unknown Location' },
    lat:   { type: Number },
    lng:   { type: Number },
    floor: { type: Number, default: 0 }
  },
  message: { type: String, default: '' },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
