const {
  distanceMeters,
  lineIntersectsPolygon,
  projectPointToSegment,
} = require("../utils/geo");

/** Map door node names (…_door) to room ids when names do not match 1:1. */
const DOOR_NAME_TO_ROOM = {
  female_washroom_door: "girls_washroom",
  sitting_room_door: "sitting_area",
  // JammuStation mappings
  entrance_exit_divyang_toilet: "toilet divyang",
  entrance_exit_ladies_toilet: "toilet female",
  entrance_exit_luggage_scanning: "luggage scannong",
  entrance_exit_toilet_gents: "toilet gents",
  // Deduplicated door names (_a / _b variants map to the same room)
  entrance_exit_general_waiting_hall_a: "general waiting hall",
  entrance_exit_general_waiting_hall_b: "general waiting hall",
  entrance_exit_security_check_a: "security check",
  entrance_exit_security_check_b: "security check",
  entrance_exit_drinking_water_a: "drinking water",
  entrance_exit_drinking_water_b: "drinking water",
  entrance_exit_waiting_area_a: "waiting area",
  entrance_exit_waiting_area_b: "waiting area",
  // Platform nodes (not rooms, but destinations)
  platform_1: "platform 1",
  platform_2: "platform 2",
  platform_3: "platform 3",
  platform_4: "platform 4",
};

function doorNameToRoomId(doorName) {
  if (DOOR_NAME_TO_ROOM[doorName]) return DOOR_NAME_TO_ROOM[doorName];
  if (doorName.endsWith("_door")) return doorName.slice(0, -5);
  if (doorName.startsWith("entrance_exit_")) {
    return doorName.replace("entrance_exit_", "").replace(/_/g, " ");
  }
  return null;
}

/**
 * Doors where users may cross the building outline from outside. Multiple per floor are supported;
 * outside routing tries each (nearest first) until an outline-safe path is found.
 */
function isPerimeterAccessDoor(properties, doorId) {
  const id = String(doorId || "");
  const p = properties || {};
  if (p.buildingEntrance === true || p.isBuildingEntrance === true) return true;
  if (p.buildingExit === true || p.isBuildingExit === true) return true;
  if (p.perimeterAccess === true) return true;
  // "entrance_exit_*" is the JammuStation room-door naming convention — NOT a perimeter access.
  // Only use the name heuristic for legacy GeoJSON (college.geojson style).
  if (/^entrance_exit_/.test(id)) return false;
  return /\bentrance\b/i.test(id) || /\bexit\b/i.test(id);
}

function hasExplicitGraphFeatures(featureCollection) {
  return (featureCollection.features || []).some((f) => {
    const t = (f?.properties?.type || "").toLowerCase();
    return t === "edge" || t === "egress_edge";
  });
}

function normalizeGeoJson(featureCollection) {
  const rooms = [];
  const boundaries = [];
  const corridors = [];
  const doors = [];
  const connectors = [];
  const graphNodes = new Map();
  const rawEdges = [];

  for (const feature of featureCollection.features || []) {
    const type = (feature?.properties?.type || "").toLowerCase();
    const name = feature?.properties?.name ?? feature?.id;
    const floor = Number(feature?.properties?.floor || 0);

    if (type === "room" && feature.geometry?.type === "Polygon") {
      rooms.push({
        roomId: feature.properties.roomId || String(name),
        polygon: feature.geometry.coordinates[0],
        doorIds: feature.properties.doorIds || [],
        floor,
      });
      continue;
    }

    if (type === "boundary" && feature.geometry?.type === "Polygon") {
      boundaries.push({
        name: feature.properties.name || "boundary",
        ring: feature.geometry.coordinates[0],
        floor,
      });
      continue;
    }

    if (type === "node" && feature.geometry?.type === "Point") {
      const nodeType = (feature.properties.nodeType || "").toLowerCase();
      graphNodes.set(String(name), {
        name: String(name),
        coordinate: feature.geometry.coordinates,
        nodeType,
        accessible: feature.properties.accessible !== false,
        floor,
      });

      if (nodeType === "door") {
        const doorId = String(name);
        const isBuildingEntrance = isPerimeterAccessDoor(feature.properties, doorId);
        doors.push({
          doorId,
          coordinate: feature.geometry.coordinates,
          connectedRoomId: doorNameToRoomId(doorId),
          floor,
          isBuildingEntrance,
          accessLabel: feature.properties.accessLabel ?? null,
          accessKind: feature.properties.accessKind ?? null,
        });
      } else if (nodeType === "ramp" || nodeType === "stair" || nodeType === "stairs") {
        connectors.push({
          connectorId: String(name),
          mode: nodeType === "stair" ? "stairs" : nodeType,
          coordinate: feature.geometry.coordinates,
          floor,
          connectsTo: feature.properties.connectsTo || [],
        });
      } else if (nodeType === "platform") {
        // Platform nodes are valid navigation destinations — register as corridor nodes
        // (they are already in graphNodes; no extra list needed for explicit-graph mode)
      }
      continue;
    }

    if ((type === "edge" || type === "egress_edge") && feature.geometry?.type === "LineString") {
      rawEdges.push({
        from: feature.properties.from,
        to: feature.properties.to,
        edgeType: feature.properties.edgeType || "corridor",
        accessible: feature.properties.accessible !== false,
        coordinates: feature.geometry.coordinates,
        floor,
      });
      continue;
    }

    if ((type === "corridor" || type === "hallway") && feature.geometry?.type === "LineString") {
      corridors.push({
        edgeId: feature.properties.edgeId || `corridor_${feature.id ?? corridors.length}`,
        coordinates: feature.geometry.coordinates,
        floor,
      });
      continue;
    }

    if (type === "door" && feature.geometry?.type === "Point") {
      const doorId = feature.properties.doorId || `door_${feature.id ?? doors.length}`;
      doors.push({
        doorId,
        connectedRoomId: feature.properties.connectedRoomId ?? null,
        connectedEdgeId: feature.properties.connectedEdgeId ?? null,
        coordinate: feature.geometry.coordinates,
        floor,
        isBuildingEntrance: isPerimeterAccessDoor(feature.properties, doorId),
        accessLabel: feature.properties.accessLabel ?? null,
        accessKind: feature.properties.accessKind ?? null,
      });
    }

    if (
      (type === "connector" || type === "stairs" || type === "elevator" || type === "ramp") &&
      feature.geometry?.type === "Point"
    ) {
      connectors.push({
        connectorId: feature.properties.connectorId || `connector_${feature.id ?? connectors.length}`,
        mode: type === "connector" ? feature.properties.mode || "stairs" : type,
        coordinate: feature.geometry.coordinates,
        floor,
        connectsTo: feature.properties.connectsTo || [],
      });
    }
  }

  for (const room of rooms) {
    if (!room.doorIds.length) {
      room.doorIds = doors
        .filter((door) => door.connectedRoomId === room.roomId)
        .map((door) => door.doorId);
    }
  }

  const explicitGraph = hasExplicitGraphFeatures(featureCollection);

  return {
    rooms,
    boundaries,
    corridors,
    doors,
    connectors,
    graphNodes,
    rawEdges,
    explicitGraph,
  };
}

function edgeMultiplier(edgeType) {
  const t = (edgeType || "").toLowerCase();
  if (t.includes("stair")) return { mult: 3.0, accessible: false };
  if (t.includes("ramp") || (t.includes("accessibility") && !t.includes("inaccessib"))) {
    return { mult: 1.2, accessible: true };
  }
  return { mult: 1.0, accessible: true };
}

function hasWallCrossing(segment, roomPolygons, ignoreRoomIds = new Set()) {
  return roomPolygons.some((room) => {
    if (ignoreRoomIds.has(room.roomId)) return false;
    return lineIntersectsPolygon(segment, room.polygon);
  });
}

function graphIdForNodeName(name, graphNodes) {
  const n = graphNodes.get(name);
  if (!n) return null;
  const nt = n.nodeType;
  if (nt === "door") return `door:${name}`;
  if (nt === "ramp" || nt === "stair" || nt === "stairs") return `connector:${name}`;
  return `node:${name}`;
}

function buildExplicitGraphRewired(normalized) {
  const { graphNodes, rawEdges, rooms } = normalized;
  const graph = {
    nodes: {},
    adjacency: {},
    corridorSegments: [],
  };
  let internalId = 0;

  function addNode(node) {
    if (!graph.nodes[node.id]) {
      graph.nodes[node.id] = node;
      graph.adjacency[node.id] = [];
    }
  }

  function addEdge(from, to, weight, type, accessible, lengthM) {
    const len = lengthM != null ? lengthM : weight;
    if (!graph.adjacency[from] || !graph.adjacency[to]) return;
    graph.adjacency[from].push({ to, weight, type, accessible, lengthM: len });
    graph.adjacency[to].push({ to: from, weight, type, accessible, lengthM: len });
  }

  for (const [name, info] of graphNodes) {
    const gid = graphIdForNodeName(name, graphNodes);
    if (!gid) continue;
    addNode({
      id: gid,
      coordinate: info.coordinate,
      floor: info.floor,
      kind:
        info.nodeType === "door"
          ? "door"
          : info.nodeType === "corridor" || info.nodeType === "platform"
            ? "corridor"
            : "connector",
      mode:
        info.nodeType === "ramp"
          ? "ramp"
          : info.nodeType === "stair" || info.nodeType === "stairs"
            ? "stairs"
            : undefined,
    });
  }

  for (const d of normalized.doors) {
    const gid = `door:${d.doorId}`;
    if (graph.nodes[gid]) graph.nodes[gid].roomId = d.connectedRoomId;
  }

  for (const edge of rawEdges) {
    const endpoints = [
      graphIdForNodeName(edge.from, graphNodes),
      graphIdForNodeName(edge.to, graphNodes),
    ];
    if (!endpoints[0] || !endpoints[1]) continue;

    const coords = edge.coordinates;
    if (!coords || coords.length < 2) continue;

    const { mult, accessible: typeAccessible } = edgeMultiplier(edge.edgeType);
    const accessible = edge.accessible !== false && typeAccessible;
    const edgeType = edge.edgeType || "corridor";

    const startCoord = graph.nodes[endpoints[0]].coordinate;
    const endCoord = graph.nodes[endpoints[1]].coordinate;
    const internalCoords = coords.length > 2 ? coords.slice(1, -1) : [];

    const vertices = [];
    vertices.push({ id: endpoints[0], coord: startCoord });
    for (const ic of internalCoords) {
      const id = `__v_${edge.from}_${edge.to}_${internalId++}`;
      addNode({ id, coordinate: ic, floor: edge.floor, kind: "corridor" });
      vertices.push({ id, coord: ic });
    }
    vertices.push({ id: endpoints[1], coord: endCoord });

    // GeoJSON edges are authoritative (junction↔door, corridor, etc.); do not reject segments
    // that touch room polygons — generic segment-vs-polygon tests would block valid door spurs.
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i];
      const b = vertices[i + 1];

      const len = distanceMeters(a.coord, b.coord);
      const dist = len * mult;
      addEdge(a.id, b.id, dist, edgeType, accessible, len);

      graph.corridorSegments.push({
        edgeId: `${edge.from}->${edge.to}`,
        floor: edge.floor,
        a: a.coord,
        b: b.coord,
        aNode: a.id,
        bNode: b.id,
        accessible,
      });
    }
  }

  return graph;
}

function buildLegacyCorridorGraph(normalized) {
  const graph = {
    nodes: {},
    adjacency: {},
    corridorSegments: [],
  };

  function addNode(node) {
    if (!graph.nodes[node.id]) {
      graph.nodes[node.id] = node;
      graph.adjacency[node.id] = [];
    }
  }

  function addEdge(from, to, weight, type = "corridor", accessible = true, lengthM) {
    const len = lengthM != null ? lengthM : weight;
    graph.adjacency[from].push({ to, weight, type, accessible, lengthM: len });
    graph.adjacency[to].push({ to: from, weight, type, accessible, lengthM: len });
  }

  for (const corridor of normalized.corridors) {
    for (let i = 0; i < corridor.coordinates.length; i++) {
      const coord = corridor.coordinates[i];
      const nodeId = `${corridor.edgeId}_n${i}`;
      addNode({ id: nodeId, coordinate: coord, floor: corridor.floor, kind: "corridor" });
      if (i > 0) {
        const prevNode = `${corridor.edgeId}_n${i - 1}`;
        const prevCoord = corridor.coordinates[i - 1];
        const segment = [prevCoord, coord];
        const blocked = hasWallCrossing(segment, normalized.rooms);
        if (!blocked) {
          addEdge(prevNode, nodeId, distanceMeters(prevCoord, coord), "corridor", true);
          graph.corridorSegments.push({
            edgeId: corridor.edgeId,
            floor: corridor.floor,
            a: prevCoord,
            b: coord,
            aNode: prevNode,
            bNode: nodeId,
            accessible: true,
          });
        }
      }
    }
  }

  for (const door of normalized.doors) {
    const doorNodeId = `door:${door.doorId}`;
    addNode({
      id: doorNodeId,
      coordinate: door.coordinate,
      floor: door.floor,
      kind: "door",
      roomId: door.connectedRoomId,
    });

    const corridorCandidates = graph.corridorSegments.filter((segment) => segment.floor === door.floor);
    let best = null;
    for (const segment of corridorCandidates) {
      const projection = projectPointToSegment(door.coordinate, segment.a, segment.b);
      const dist = distanceMeters(door.coordinate, projection);
      if (!best || dist < best.distance) best = { segment, projection, distance: dist };
    }

    if (best) {
      const { segment } = best;
      const blocked = hasWallCrossing(
        [door.coordinate, segment.a],
        normalized.rooms,
        new Set([door.connectedRoomId])
      );
      const blocked2 = hasWallCrossing(
        [door.coordinate, segment.b],
        normalized.rooms,
        new Set([door.connectedRoomId])
      );
      if (!blocked) addEdge(doorNodeId, segment.aNode, distanceMeters(door.coordinate, segment.a), "door", true);
      if (!blocked2) addEdge(doorNodeId, segment.bNode, distanceMeters(door.coordinate, segment.b), "door", true);
    }
  }

  for (const connector of normalized.connectors) {
    const nodeId = `connector:${connector.connectorId}`;
    addNode({
      id: nodeId,
      coordinate: connector.coordinate,
      floor: connector.floor,
      kind: "connector",
      mode: connector.mode,
    });
  }

  for (const connector of normalized.connectors) {
    const fromId = `connector:${connector.connectorId}`;
    for (const targetId of connector.connectsTo) {
      const toId = `connector:${targetId}`;
      if (!graph.nodes[toId]) continue;
      const connLen = distanceMeters(graph.nodes[fromId].coordinate, graph.nodes[toId].coordinate);
      addEdge(
        fromId,
        toId,
        connLen * (connector.mode === "stairs" ? 3.0 : connector.mode === "ramp" ? 1.2 : 1.0),
        connector.mode,
        connector.mode !== "stairs",
        connLen
      );
    }
  }

  return graph;
}

function buildGraphFromGeoJson(featureCollection) {
  const normalized = normalizeGeoJson(featureCollection);
  let graph;

  if (normalized.explicitGraph && normalized.rawEdges.length) {
    graph = buildExplicitGraphRewired(normalized);
  } else {
    graph = buildLegacyCorridorGraph(normalized);
  }

  return { graph, normalized };
}

module.exports = { buildGraphFromGeoJson, normalizeGeoJson, doorNameToRoomId };
