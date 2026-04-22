const mongoose = require('mongoose');

const crowdReadingSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  density: { type: String, enum: ['low', 'medium', 'high'], required: true },
  personCount: { type: Number, default: 0 },
  source: { type: String, enum: ['camera', 'sensor', 'simulated'], default: 'simulated' },
  floor: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

// Index for quick lookup by nodeId
crowdReadingSchema.index({ nodeId: 1, timestamp: -1 });

// Static method: get latest reading for each node
crowdReadingSchema.statics.getLatestAll = async function () {
  return this.aggregate([
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$nodeId', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } }
  ]);
};

module.exports = mongoose.model('CrowdReading', crowdReadingSchema);
