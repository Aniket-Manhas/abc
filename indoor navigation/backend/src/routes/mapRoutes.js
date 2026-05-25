const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const MapData = require("../models/MapData");
const { buildGraphFromGeoJson } = require("../services/graphBuilder");
const { setActiveMap } = require("../services/mapState");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function collegeGeoJsonPath() {
  return process.env.COLLEGE_GEOJSON_PATH || path.join(__dirname, "..", "..", "..", "college.geojson");
}

function jammuGeoJsonPath() {
  return process.env.JAMMU_GEOJSON_PATH || path.join(__dirname, "..", "..", "..", "JammuStation.geojson");
}

function parseGeoJsonFromRequest(req) {
  if (req.body?.useJammu === true || req.body?.useJammu === "true") {
    const p = jammuGeoJsonPath();
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  if (req.body?.useCollege === true || req.body?.useCollege === "true") {
    const p = collegeGeoJsonPath();
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  if (req.body?.useSample === true || req.body?.useSample === "true") {
    const samplePath = path.join(__dirname, "../../data/sample-indoor.geojson");
    return JSON.parse(fs.readFileSync(samplePath, "utf-8"));
  }
  if (req.file?.buffer) {
    return JSON.parse(req.file.buffer.toString("utf-8"));
  }
  if (req.body?.geojson && typeof req.body.geojson === "string") {
    return JSON.parse(req.body.geojson);
  }
  if (req.body?.geojson && typeof req.body.geojson === "object") {
    return req.body.geojson;
  }
  throw new Error("No geojson provided. Use multipart file, geojson JSON body, or useCollege/useSample.");
}

// GET /geojson and GET /map-status are registered on `app` in app.js (explicit paths).

router.post("/load-map", upload.single("file"), async (req, res, next) => {
  try {
    const mapId = req.body?.mapId || "default-map";
    const name = req.body?.name || "Indoor Campus Map";
    const sourceGeoJson = parseGeoJsonFromRequest(req);

    const { graph, normalized } = buildGraphFromGeoJson(sourceGeoJson);
    const payload = { mapId, name, sourceGeoJson, graph, normalized };
    setActiveMap(payload);

    if (process.env.MONGO_URI) {
      await MapData.findOneAndUpdate(
        { mapId },
        { mapId, name, sourceGeoJson, graph, normalized },
        { upsert: true, new: true }
      );
    }

    res.json({
      ok: true,
      mapId,
      stats: {
        rooms: normalized.rooms.length,
        corridors: normalized.corridors.length,
        doors: normalized.doors.length,
        connectors: normalized.connectors.length,
        graphNodes: Object.keys(graph.nodes).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
