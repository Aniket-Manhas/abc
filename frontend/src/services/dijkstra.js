/**
 * Dijkstra's shortest path algorithm
 * Supports: crowd-aware weighting, accessibility filtering (no stairs)
 */

export function buildAdjacencyList(graphData) {
  const adj = {};
  const { nodes, edges } = graphData;
  
  Object.keys(nodes).forEach(id => { adj[id] = []; });
  
  edges.forEach(edge => {
    const { from, to, distance, hasStairs, hasLift, hasRamp, floor } = edge;
    if (adj[from] !== undefined && adj[to] !== undefined) {
      adj[from].push({ to, distance, hasStairs, hasLift, hasRamp, floor });
      adj[to].push({ to: from, distance, hasStairs, hasLift, hasRamp, floor });
    }
  });
  
  return adj;
}

export function dijkstra({
  graphData,
  source,
  destination,
  crowdData = {},          // { nodeId: 'low'|'medium'|'high' }
  accessibilityMode = 'none',
  avoidStairs = false,
}) {
  const { nodes, crowdWeightMultipliers = { low: 1, medium: 1.5, high: 3 } } = graphData;
  const adj = buildAdjacencyList(graphData);

  const isAccessible = avoidStairs || accessibilityMode !== 'none';

  const dist = {};
  const prev = {};
  const visited = new Set();

  Object.keys(nodes).forEach(id => {
    dist[id] = Infinity;
    prev[id] = null;
  });
  dist[source] = 0;

  // Simple priority queue (min-heap simulation via sorted array)
  const pq = [{ node: source, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { node: u } = pq.shift();

    if (visited.has(u)) continue;
    visited.add(u);
    if (u === destination) break;

    (adj[u] || []).forEach(({ to: v, distance, hasStairs }) => {
      if (visited.has(v)) return;

      // Accessibility: skip stairs edges
      if (isAccessible && hasStairs) return;

      // Crowd weight on node v
      const crowdLevel = crowdData[v] || 'low';
      const crowdMult = crowdWeightMultipliers[crowdLevel] || 1;

      const edgeCost = distance * crowdMult;
      const newDist = dist[u] + edgeCost;

      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
        pq.push({ node: v, cost: newDist });
      }
    });
  }

  // Reconstruct path
  if (dist[destination] === Infinity) return null;

  const path = [];
  let cur = destination;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }

  // Calculate real distance (no crowd multiplier) for ETA
  const realDistance = computeRealDistance(path, graphData);
  const walkingSpeedMps = graphData.walkingSpeedMps || 1.2;
  const etaSeconds = Math.ceil(realDistance / walkingSpeedMps);

  return { path, totalCost: dist[destination], realDistance, etaSeconds };
}

function computeRealDistance(path, graphData) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const edge = graphData.edges.find(
      e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
    );
    if (edge) total += edge.distance;
  }
  return total;
}

export function formatETA(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.ceil(seconds / 60);
  return `${mins} min`;
}

export function pathToCoordinates(path, nodes) {
  return path
    .filter(id => nodes[id])
    .map(id => [nodes[id].lng, nodes[id].lat]);
}

export function buildStepDirections(path, nodes, graphData) {
  const steps = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromNode = nodes[path[i]];
    const toNode = nodes[path[i + 1]];
    if (!fromNode || !toNode) continue;

    const edge = graphData.edges.find(
      e => (e.from === path[i] && e.to === path[i + 1]) ||
           (e.from === path[i + 1] && e.to === path[i])
    );

    let instruction = `Head to ${toNode.name}`;
    if (edge?.hasLift) instruction = `Take lift to ${toNode.name}`;
    else if (edge?.hasStairs) instruction = `Use stairs to ${toNode.name}`;
    else if (edge?.hasRamp) instruction = `Use ramp to ${toNode.name}`;
    else if (toNode.floor > fromNode.floor) instruction = `Go up to floor ${toNode.floor} — ${toNode.name}`;
    else if (toNode.floor < fromNode.floor) instruction = `Go down to floor ${toNode.floor} — ${toNode.name}`;

    steps.push({
      stepNum: i + 1,
      from: fromNode.name,
      to: toNode.name,
      instruction,
      distance: edge?.distance || 0,
      type: toNode.type,
      hasLift: edge?.hasLift,
      hasStairs: edge?.hasStairs,
      hasRamp: edge?.hasRamp,
    });
  }
  return steps;
}
