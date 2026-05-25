const mongoose = require("mongoose");

const mapDataSchema = new mongoose.Schema(
  {
    mapId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    sourceGeoJson: { type: Object, required: true },
    normalized: {
      rooms: { type: Array, default: [] },
      corridors: { type: Array, default: [] },
      doors: { type: Array, default: [] },
      connectors: { type: Array, default: [] },
    },
    graph: { type: Object, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MapData", mapDataSchema);
