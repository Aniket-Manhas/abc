const fs = require('fs');
const { buildGraphFromGeoJson } = require('./src/services/graphBuilder');
const { computeRoute } = require('./src/services/spatialEngine');

const geojson = JSON.parse(fs.readFileSync('../JammuStation.geojson', 'utf8'));
const { graph, normalized } = buildGraphFromGeoJson(geojson);

console.log("Testing computeRoute for 'parcel office':");
try {
  const route = computeRoute({
    graph,
    normalized,
    from: [74.88044238733866, 32.70532507410803], // somewhere near waiting area
    toRoomId: 'parcel office',
    floor: 0,
    accessibleOnly: false
  });
  console.log("Success! Route length:", route.path.length);
} catch (err) {
  console.error("Route failed:", err.message);
}


