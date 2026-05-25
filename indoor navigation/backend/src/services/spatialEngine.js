const {
  centroid,
  closestPointOnRing,
  distanceMeters,
  lineIntersectsPolygon,
  pointInPolygon,
  projectPointToSegment,
} = require("../utils/geo");
const { cloneGraph, runAStar } = require("./router");

function nearestDoor(room, doors, point) {
  const candidates = doors.filter((door) => room.doorIds.includes(door.doorId));
  if (!candidates.length) return null;
  return candidates.reduce((best, door) => {
    const d = distanceMeters(point, door.coordinate);
    if (!best || d < best.distance) return { door, distance: d };
    return best;
  }, null).door;
}

function findRoomContainingPoint(point, floor, rooms) {
  return rooms.find((room) => room.floor === floor && pointInPolygon(point, room.polygon)) || null;
}

function lineCrossesAnyRoom(segment, rooms, ignoreRoomIds = new Set()) {
  return rooms.some((room) => {
    if (ignoreRoomIds.has(room.roomId)) return false;
    return lineIntersectsPolygon(segment, room.polygon);
  });
}

function injectVirtualStart(graph, point, floor, rooms, accessibleOnly = false) {
  const candidates = graph.corridorSegments.filter((segment) => {
    if (segment.floor !== floor) return false;
    if (!accessibleOnly) return true;
    return segment.accessible === true;
  });
  let best = null;
  for (const segment of candidates) {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    const blocked = lineCrossesAnyRoom([point, projected], rooms);
    if (blocked) continue;
    const dist = distanceMeters(point, projected);
    if (!best || dist < best.distance) best = { segment, projected, distance: dist };
  }
  if (!best) return null;

  const virtualNodeId = "__virtual_start";
  graph.nodes[virtualNodeId] = { id: virtualNodeId, coordinate: best.projected, floor, kind: "virtual" };
  graph.adjacency[virtualNodeId] = [];

  const dA = distanceMeters(best.projected, best.segment.a);
  const dB = distanceMeters(best.projected, best.segment.b);
  const vA = { to: best.segment.aNode, weight: dA, type: "virtual", accessible: true, lengthM: dA };
  const vB = { to: best.segment.bNode, weight: dB, type: "virtual", accessible: true, lengthM: dB };
  graph.adjacency[virtualNodeId].push(vA, vB);
  graph.adjacency[best.segment.aNode].push({ ...vA, to: virtualNodeId });
  graph.adjacency[best.segment.bNode].push({ ...vB, to: virtualNodeId });

  return { virtualNodeId, projected: best.projected };
}

function findDestinationDoor(goalRoomId, normalized) {
  const room = normalized.rooms.find((r) => r.roomId === goalRoomId);
  console.log(`findDestinationDoor: goalRoomId="${goalRoomId}", roomFound=${!!room}`);
  if (!room) return null;
  const roomCenter = centroid(room.polygon);
  console.log(`findDestinationDoor: room.doorIds=${JSON.stringify(room.doorIds)}`);
  const door = nearestDoor(room, normalized.doors, roomCenter);
  console.log(`findDestinationDoor: nearestDoorFound=${!!door}`);
  if (!door) return null;
  return { room, door, roomCenter };
}

function boundaryForFloor(normalized, floor) {
  const list = normalized.boundaries || [];
  const onFloor = list.filter((b) => b.floor === floor);
  return onFloor[0] || list[0] || null;
}

function isOutsideBuildingFootprint(point, boundary) {
  if (!boundary) return false;
  return !pointInPolygon(point, boundary.ring);
}

function pathLengthMeters(coords) {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) sum += distanceMeters(coords[i], coords[i + 1]);
  return sum;
}

/** Dense samples along the closed boundary ring (exterior walk path). */
function discretizeRing(ring, stepsPerEdge) {
  const pts = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < stepsPerEdge; s++) {
      const t = s / stepsPerEdge;
      pts.push([
        ring[i][0] + t * (ring[i + 1][0] - ring[i][0]),
        ring[i][1] + t * (ring[i + 1][1] - ring[i][1]),
      ]);
    }
  }
  return pts;
}

function nearestSampleIndex(samples, point) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = distanceMeters(point, samples[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function walkSamplesForward(samples, i, j) {
  const n = samples.length;
  const out = [samples[i]];
  let k = i;
  let guard = 0;
  while (k !== j && guard++ < n + 3) {
    k = (k + 1) % n;
    out.push(samples[k]);
  }
  return out;
}

function walkSamplesBackward(samples, i, j) {
  const n = samples.length;
  const out = [samples[i]];
  let k = i;
  let guard = 0;
  while (k !== j && guard++ < n + 3) {
    k = (k - 1 + n) % n;
    out.push(samples[k]);
  }
  return out;
}

function shortestSamplePath(samples, i, j) {
  const a = walkSamplesForward(samples, i, j);
  const b = walkSamplesBackward(samples, i, j);
  return pathLengthMeters(a) <= pathLengthMeters(b) ? a : b;
}

function dedupeCoords(coords, minMeters = 0.06) {
  const out = [];
  for (const c of coords) {
    if (!out.length || distanceMeters(out[out.length - 1], c) >= minMeters) out.push(c);
  }
  return out;
}

/**
 * Outside users must reach a mapped building entrance without cutting through interior rooms.
 * A straight chord often crosses room polygons; we walk along the boundary outline, then step in at the door.
 */
function tryOutsideApproachViaOutline(from, door, ring, rooms, stepsPerEdge) {
  const foot = closestPointOnRing(from, ring);
  const samples = discretizeRing(ring, stepsPerEdge);
  const iFrom = nearestSampleIndex(samples, foot);
  const iDoor = nearestSampleIndex(samples, door.coordinate);
  const arc = shortestSamplePath(samples, iFrom, iDoor);
  const merged = dedupeCoords([from, foot, ...arc.slice(1), door.coordinate]);
  if (!segmentsValidAgainstRooms(merged, rooms)) return null;
  return merged;
}

function segmentsValidAgainstRooms(coords, rooms) {
  for (let i = 0; i < coords.length - 1; i++) {
    if (lineCrossesAnyRoom([coords[i], coords[i + 1]], rooms)) return false;
  }
  return true;
}

function coordinatePathFromNodePath(nodePath, graph) {
  return nodePath.map((nodeId) => graph.nodes[nodeId].coordinate);
}

function computeRoute({ graph: baseGraph, normalized, from, toRoomId, floor, accessibleOnly }) {
  const graph = cloneGraph(baseGraph);
  const room = findRoomContainingPoint(from, floor, normalized.rooms);
  
  const destRoom = normalized.rooms.find((r) => r.roomId === toRoomId);
  if (!destRoom) {
    throw new Error(`Unknown destination room "${toRoomId}".`);
  }
  const destDoors = normalized.doors.filter(d => destRoom.doorIds.includes(d.doorId) && graph.nodes[`door:${d.doorId}`]);
  if (!destDoors.length) {
    throw new Error(`Destination room "${toRoomId}" has no mapped doors connected to graph.`);
  }

  // Inject virtual destination connected to all valid doors of the destination room with 0 cost
  const VIRTUAL_DEST = "__virtual_dest";
  graph.nodes[VIRTUAL_DEST] = { id: VIRTUAL_DEST, coordinate: centroid(destRoom.polygon), floor, kind: "virtual" };
  graph.adjacency[VIRTUAL_DEST] = [];
  for (const d of destDoors) {
    const dId = `door:${d.doorId}`;
    graph.adjacency[dId].push({ to: VIRTUAL_DEST, weight: 0, type: "virtual", accessible: true, lengthM: 0 });
    graph.adjacency[VIRTUAL_DEST].push({ to: dId, weight: 0, type: "virtual", accessible: true, lengthM: 0 });
  }

  let startNodeId;
  let prePath = [from];
  let outsideApproach = null;
  let nodePath = null;

  if (room) {
    // Enforce room -> door flow
    const entryDoor = nearestDoor(room, normalized.doors, from);
    if (!entryDoor) throw new Error(`Room "${room.roomId}" has no door for exit.`);
    const blocked = lineCrossesAnyRoom([from, entryDoor.coordinate], normalized.rooms, new Set([room.roomId]));
    if (blocked) throw new Error("No valid straight path from current point to room door.");
    startNodeId = `door:${entryDoor.doorId}`;
    prePath = [from, entryDoor.coordinate];
    nodePath = runAStar(graph, startNodeId, VIRTUAL_DEST, { accessibleOnly });
  } else {
    const boundary = boundaryForFloor(normalized, floor);
    if (isOutsideBuildingFootprint(from, boundary)) {
      const entrances = normalized.doors.filter(
        (d) => d.isBuildingEntrance && d.floor === floor && graph.nodes[`door:${d.doorId}`]
      );
      if (!entrances.length) {
        throw new Error("You appear to be outside the building, but no perimeter entrances are mapped for this floor.");
      }
      const ranked = entrances
        .map((door) => ({ door, dist: distanceMeters(from, door.coordinate) }))
        .sort((a, b) => a.dist - b.dist);

      for (const { door } of ranked) {
        for (const steps of [4, 7, 12, 20]) {
          const prePathTry = tryOutsideApproachViaOutline(from, door, boundary.ring, normalized.rooms, steps);
          if (!prePathTry) continue;
          const start = `door:${door.doorId}`;
          const np = runAStar(graph, start, VIRTUAL_DEST, { accessibleOnly });
          if (np) {
            startNodeId = start;
            prePath = prePathTry;
            nodePath = np;
            outsideApproach = {
              doorId: door.doorId,
              label: door.accessLabel || door.doorId.replace(/_/g, " "),
              coordinate: door.coordinate,
              pathToEntrance: prePathTry.map((c) => [...c]),
            };
            break;
          }
        }
        if (nodePath) break;
      }

      if (!nodePath) {
        throw new Error(accessibleOnly ? "No step-free route from any mapped entrance." : "You appear to be outside the building. Move closer to a mapped entrance.");
      }
    } else {
      const virtual = injectVirtualStart(graph, from, floor, normalized.rooms, accessibleOnly);
      if (!virtual) {
        throw new Error(accessibleOnly ? "Unable to snap your position to a step-free corridor segment." : "Unable to project user position to visible corridor segment.");
      }
      startNodeId = virtual.virtualNodeId;
      prePath = [from, virtual.projected];
      nodePath = runAStar(graph, startNodeId, VIRTUAL_DEST, { accessibleOnly });
    }
  }

  if (!nodePath) {
    throw new Error("No route available to destination.");
  }

  // Remove the virtual destination node from the final path
  const finalNodes = nodePath.filter(n => n !== VIRTUAL_DEST);
  const coords = coordinatePathFromNodePath(finalNodes, graph);
  
  // Don't jump to centroid (causes wall-crossing). The path ends at the destination door.
  // Find nearest point on destination room polygon boundary from the last door instead.
  const lastCoord = coords.length > 0 ? coords[coords.length - 1] : prePath[prePath.length - 1];
  // destRoom.polygon is already the outer ring (flat array of [lng,lat] pairs from graphBuilder).
  // Do NOT do polygon[0] — that would return a single coordinate pair, not a ring.
  const destRing = Array.isArray(destRoom.polygon[0][0]) ? destRoom.polygon[0] : destRoom.polygon;
  const destEdgePoint = closestPointOnRing(lastCoord, destRing);
  
  // Only add the edge point if it doesn't cross another room
  const edgeSegmentBlocked = lineCrossesAnyRoom(
    [lastCoord, destEdgePoint],
    normalized.rooms,
    new Set([destRoom.roomId])
  );

  const fullPath = edgeSegmentBlocked
    ? [...prePath, ...coords.slice(1)]                           // stop at door, no wall cross
    : [...prePath, ...coords.slice(1), destEdgePoint];           // end at room boundary

  return {
    fromRoomId: room?.roomId || null,
    destinationRoomId: destRoom.roomId,
    path: fullPath,
    pathNodes: finalNodes,
    outsideApproach,
    totalWeight: pathLengthMeters(fullPath),
  };
}

module.exports = {
  nearestDoor,
  computeRoute,
};
