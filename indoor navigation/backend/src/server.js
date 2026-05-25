require("dotenv").config();

const fs = require("fs");
const path = require("path");
const app = require("./app");
const { connectDatabase } = require("./config/database");
const { buildGraphFromGeoJson } = require("./services/graphBuilder");
const { setActiveMap } = require("./services/mapState");

const PORT = Number(process.env.PORT || 4000);

function loadGeoJsonOnStartup() {
  const jammuPath =
    process.env.JAMMU_GEOJSON_PATH || path.join(__dirname, "..", "..", "JammuStation.geojson");
  if (fs.existsSync(jammuPath)) {
    try {
      const sourceGeoJson = JSON.parse(fs.readFileSync(jammuPath, "utf-8"));
      const { graph, normalized } = buildGraphFromGeoJson(sourceGeoJson);
      setActiveMap({
        mapId: "jammu",
        name: "Jammu Station",
        sourceGeoJson,
        graph,
        normalized,
      });
      console.log(
        `Loaded JammuStation.geojson (${normalized.rooms.length} rooms, ${Object.keys(graph.nodes).length} graph nodes)`
      );
      return;
    } catch (err) {
      console.error("Failed to load JammuStation.geojson:", err.message);
    }
  }

  const collegePath =
    process.env.COLLEGE_GEOJSON_PATH || path.join(__dirname, "..", "..", "college.geojson");
  if (!fs.existsSync(collegePath)) {
    console.warn("college.geojson not found at", collegePath, "— use POST /load-map to load data.");
    return;
  }
  try {
    const sourceGeoJson = JSON.parse(fs.readFileSync(collegePath, "utf-8"));
    const { graph, normalized } = buildGraphFromGeoJson(sourceGeoJson);
    setActiveMap({
      mapId: "college",
      name: "College",
      sourceGeoJson,
      graph,
      normalized,
    });
    console.log(
      `Loaded college.geojson (${normalized.rooms.length} rooms, ${Object.keys(graph.nodes).length} graph nodes)`
    );
  } catch (err) {
    console.error("Failed to load college.geojson:", err.message);
  }
}

async function bootstrap() {
  try {
    if (process.env.MONGO_URI) {
      await connectDatabase();
      console.log('✅ MongoDB connected');
    } else {
      console.log('ℹ️ No MONGO_URI provided — running in standalone mode (no DB)');
    }
  } catch (err) {
    console.warn('⚠️ Could not connect to MongoDB:', err.message);
  }
  loadGeoJsonOnStartup();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Indoor navigation backend running on port ${PORT}`);
    console.log(`  GET /api/geojson  GET /api/map-status  GET /api/route?from=lat,lng&to=roomId`);
    console.log(`  Frontend dev: Vite proxies http://localhost:5173/api/* → http://localhost:${PORT}/api/*`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to boot server", error);
  process.exit(1);
});
