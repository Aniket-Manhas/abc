const mongoose = require("mongoose");

const userPositionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    mapId: { type: String, required: true, index: true },
    floor: { type: Number, default: 0 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
  },
  { timestamps: true }
);

userPositionSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("UserPosition", userPositionSchema);
