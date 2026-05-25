const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { getActiveMap } = require("./services/mapState");
const mapRoutes = require("./routes/mapRoutes");
const positionRoutes = require("./routes/positionRoutes");
const routeRoutes = require("./routes/routeRoutes");

const app = express();

const allowedOriginsStr = process.env.CORS_ORIGIN || '';
const configuredOrigins = allowedOriginsStr.split(',').map(s => s.trim()).filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (origin.startsWith('exp://')) return true; // allow expo
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?$/.test(origin);
};

app.use(cors({ 
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  }
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "indoor-navigation-backend" });
});

// Registered before Router mounts so Express 5 always matches (avoids "Cannot GET /api/geojson").
function sendGeoJson(req, res) {
  const map = getActiveMap();
  if (!map?.sourceGeoJson) {
    console.warn(
      "[api]",
      req.method,
      req.originalUrl,
      "— no map in memory (run backend from project root so JammuStation.geojson or college.geojson loads)"
    );
    return res.status(404).json({ ok: false, error: "No map loaded." });
  }
  const n = map.sourceGeoJson.features?.length ?? 0;
  console.log("[api]", req.method, req.originalUrl, "— ok, features:", n, "mapId:", map.mapId);
  res.json(map.sourceGeoJson);
}

function sendMapStatus(_req, res) {
  const map = getActiveMap();
  const payload = {
    ok: true,
    loaded: Boolean(map),
    mapId: map?.mapId || null,
    name: map?.name || null,
  };
  console.log("[api]", _req.method, _req.originalUrl, payload);
  res.json(payload);
}

app.get("/api/geojson", sendGeoJson);
app.get("/geojson", sendGeoJson);
app.get("/api/map-status", sendMapStatus);
app.get("/map-status", sendMapStatus);

// Primary API prefix (matches Vite dev proxy: /api → backend)
app.use("/api", mapRoutes);
app.use("/api", positionRoutes);
app.use("/api", routeRoutes);

// Legacy paths without /api (direct calls to :4000/load-map, etc.)
app.use(mapRoutes);
app.use(positionRoutes);
app.use(routeRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: error.message || "Internal Server Error",
  });
});

module.exports = app;
