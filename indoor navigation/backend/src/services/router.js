const { distanceMeters } = require("../utils/geo");

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  push(value, priority) {
    this.items.push({ value, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop() {
    return this.items.shift();
  }

  get size() {
    return this.items.length;
  }
}

function cloneGraph(graph) {
  return {
    nodes: JSON.parse(JSON.stringify(graph.nodes)),
    adjacency: JSON.parse(JSON.stringify(graph.adjacency)),
    corridorSegments: graph.corridorSegments,
  };
}

function runAStar(graph, startNodeId, goalNodeId, options = {}) {
  const accessibleOnly = Boolean(options.accessibleOnly);
  const open = new PriorityQueue();
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  gScore[startNodeId] = 0;
  fScore[startNodeId] = distanceMeters(graph.nodes[startNodeId].coordinate, graph.nodes[goalNodeId].coordinate);
  open.push(startNodeId, fScore[startNodeId]);

  while (open.size > 0) {
    const current = open.pop().value;
    if (current === goalNodeId) {
      const path = [current];
      while (cameFrom[path[0]]) path.unshift(cameFrom[path[0]]);
      return path;
    }

    for (const edge of graph.adjacency[current] || []) {
      if (accessibleOnly && !edge.accessible) continue;
      const stepCost = accessibleOnly ? edge.weight : (edge.lengthM != null ? edge.lengthM : edge.weight);
      const tentative = gScore[current] + stepCost;
      if (tentative < (gScore[edge.to] ?? Number.POSITIVE_INFINITY)) {
        cameFrom[edge.to] = current;
        gScore[edge.to] = tentative;
        fScore[edge.to] =
          tentative + distanceMeters(graph.nodes[edge.to].coordinate, graph.nodes[goalNodeId].coordinate);
        open.push(edge.to, fScore[edge.to]);
      }
    }
  }

  return null;
}

module.exports = { runAStar, cloneGraph };
