const EARTH_RADIUS_M = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function pointInPolygon(point, polygonRing) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygonRing.length - 1; i < polygonRing.length; j = i++) {
    const [xi, yi] = polygonRing[i];
    const [xj, yj] = polygonRing[j];

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function lineIntersectsPolygon(line, polygonRing) {
  const [start, end] = line;
  for (let i = 0; i < polygonRing.length - 1; i++) {
    if (segmentsIntersect(start, end, polygonRing[i], polygonRing[i + 1])) {
      return true;
    }
  }

  // Segment fully within the polygon should also count as blocked.
  if (pointInPolygon(start, polygonRing) || pointInPolygon(end, polygonRing)) {
    return true;
  }

  return false;
}

function projectPointToSegment(point, segmentStart, segmentEnd) {
  const [x, y] = point;
  const [x1, y1] = segmentStart;
  const [x2, y2] = segmentEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return segmentStart;

  const t = ((x - x1) * dx + (y - y1) * dy) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  return [x1 + clamped * dx, y1 + clamped * dy];
}

function centroid(polygonRing) {
  const vertices = polygonRing.slice(0, -1);
  if (!vertices.length) return polygonRing[0];
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of vertices) {
    sumX += x;
    sumY += y;
  }
  return [sumX / vertices.length, sumY / vertices.length];
}

/** Closest point on a closed linear ring (each consecutive pair is an edge). */
function closestPointOnRing(point, ring) {
  let best = ring[0];
  let bestD = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const p = projectPointToSegment(point, ring[i], ring[i + 1]);
    const d = distanceMeters(point, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function computeBearing(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const startLat = toRadians(lat1);
  const startLng = toRadians(lng1);
  const endLat = toRadians(lat2);
  const endLng = toRadians(lng2);

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

  const bearingRad = Math.atan2(y, x);
  return (bearingRad * 180 / Math.PI + 360) % 360;
}

function generateDirections(path) {
  if (!path || path.length < 2) return ["You have arrived at your destination."];
  
  const directions = [];
  let currentBearing = computeBearing(path[0], path[1]);
  let segmentDistance = 0;
  
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i+1];
    const dist = distanceMeters(p1, p2);
    const bearing = computeBearing(p1, p2);
    
    // Determine turn
    const turnAngle = bearing - currentBearing;
    let turnAngleNorm = (turnAngle + 360) % 360;
    if (turnAngleNorm > 180) turnAngleNorm -= 360; // range: -180 to 180
    
    if (Math.abs(turnAngleNorm) > 20) {
      // It's a noticeable turn
      if (segmentDistance > 0) {
        directions.push(`Go straight for ${Math.round(segmentDistance)} meters.`);
      }
      
      let turnStr = "Turn slightly right";
      if (turnAngleNorm > 45 && turnAngleNorm <= 135) turnStr = "Turn right";
      else if (turnAngleNorm > 135) turnStr = "Make a U-turn";
      else if (turnAngleNorm < -45 && turnAngleNorm >= -135) turnStr = "Turn left";
      else if (turnAngleNorm < -135) turnStr = "Make a U-turn";
      else if (turnAngleNorm < 0) turnStr = "Turn slightly left";
      
      directions.push(turnStr);
      segmentDistance = dist;
      currentBearing = bearing;
    } else {
      // Continuing relatively straight
      segmentDistance += dist;
      currentBearing = bearing; // update slightly
    }
  }
  
  if (segmentDistance > 0) {
    directions.push(`Go straight for ${Math.round(segmentDistance)} meters.`);
  }
  directions.push("You have arrived at your destination.");
  
  return directions;
}

module.exports = {
  distanceMeters,
  pointInPolygon,
  lineIntersectsPolygon,
  projectPointToSegment,
  centroid,
  closestPointOnRing,
  computeBearing,
  generateDirections
};
