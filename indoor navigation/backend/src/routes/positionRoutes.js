const express = require("express");
const UserPosition = require("../models/UserPosition");
const { getActiveMap } = require("../services/mapState");

const router = express.Router();

router.post("/update-position", async (req, res, next) => {
  try {
    const { userId = "anonymous", lat, lng, floor = 0 } = req.body || {};
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ ok: false, error: "lat and lng must be numbers" });
    }

    const map = getActiveMap();
    const mapId = map?.mapId || "default-map";

    if (process.env.MONGO_URI) {
      await UserPosition.findOneAndUpdate(
        { userId },
        {
          userId,
          mapId,
          floor,
          location: { type: "Point", coordinates: [lng, lat] },
        },
        { upsert: true, new: true }
      );
    }

    return res.json({
      ok: true,
      userId,
      mapId,
      floor,
      location: [lng, lat],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
