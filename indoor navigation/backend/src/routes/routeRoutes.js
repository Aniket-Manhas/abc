const express = require("express");
const { getActiveMap } = require("../services/mapState");
const { computeRoute } = require("../services/spatialEngine");
const { generateDirections } = require("../utils/geo");

const router = express.Router();

function parseLatLng(raw) {
  if (!raw) return null;
  const [latRaw, lngRaw] = raw.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
}

router.get("/route", (req, res, next) => {
  try {
    const map = getActiveMap();
    if (!map) return res.status(400).json({ ok: false, error: "No map loaded. Call POST /load-map first." });

    const from = parseLatLng(req.query.from);
    const toRoomId = req.query.to;
    const floor = Number(req.query.floor ?? 0);
    const accessibleOnly = String(req.query.accessible || "false") === "true";

    if (!from || !toRoomId) {
      return res.status(400).json({ ok: false, error: "Provide from=lat,lng and to=roomId query params." });
    }

    const route = computeRoute({
      graph: map.graph,
      normalized: map.normalized,
      from,
      toRoomId,
      floor,
      accessibleOnly,
    });

    const directions = generateDirections(route.path);

    return res.json({
      ok: true,
      mapId: map.mapId,
      ...route,
      // Output follows [lng, lat] coordinates for direct map rendering.
      coordinates: route.path,
      directions,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
