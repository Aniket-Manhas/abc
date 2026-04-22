const CrowdReading = require('../models/CrowdReading');

const NODE_NAMES = {
  gate_a: 'Entry Gate A (Main)', gate_b: 'Entry Gate B (North)',
  exit: 'Exit Gate', ticket_1: 'Ticket Counter 1', ticket_2: 'Ticket Counter 2',
  ticket_3: 'Ticket Counter 3', concourse: 'Main Concourse',
  waiting_main: 'Waiting Area (Main)', waiting_vip: 'VIP Waiting Lounge',
  platform_1: 'Platform 1 (Arrivals)', platform_2: 'Platform 2 (Departures)',
  fob: 'Foot Over Bridge', lift_1: 'Lift 1', lift_2: 'Lift 2',
  stairs_1: 'Stairs 1', stairs_2: 'Stairs 2',
  food_1: 'Canteen / Food Stall', food_2: 'Coffee Shop',
  restroom: 'Restrooms', medical: 'Medical Aid', inquiry: 'Inquiry Desk',
  atm: 'ATM', ramp_1: 'Wheelchair Ramp 1',
  p1_coach_a: 'Platform 1 — Coach 1-6', p1_coach_b: 'Platform 1 — Coach 7-12',
  p2_coach_a: 'Platform 2 — Coach 1-6', p2_coach_b: 'Platform 2 — Coach 7-12'
};

// Simulate realistic crowd patterns based on time of day
const getRealisticDensity = (nodeId, hour) => {
  // Peak hours: 8-10am, 5-8pm
  const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const isMidPeak = (hour >= 11 && hour <= 14);

  const highProbNodes = ['platform_1', 'platform_2', 'concourse', 'gate_a'];
  const medProbNodes = ['ticket_1', 'ticket_2', 'waiting_main', 'fob', 'stairs_1', 'stairs_2'];

  let rand = Math.random();

  if (isPeakHour) {
    if (highProbNodes.includes(nodeId)) {
      return rand < 0.6 ? 'high' : rand < 0.85 ? 'medium' : 'low';
    }
    if (medProbNodes.includes(nodeId)) {
      return rand < 0.4 ? 'high' : rand < 0.75 ? 'medium' : 'low';
    }
    return rand < 0.2 ? 'high' : rand < 0.55 ? 'medium' : 'low';
  } else if (isMidPeak) {
    if (highProbNodes.includes(nodeId)) {
      return rand < 0.3 ? 'high' : rand < 0.65 ? 'medium' : 'low';
    }
    return rand < 0.1 ? 'high' : rand < 0.45 ? 'medium' : 'low';
  } else {
    return rand < 0.05 ? 'high' : rand < 0.3 ? 'medium' : 'low';
  }
};

const densityToCount = (density) => {
  if (density === 'high') return Math.floor(Math.random() * 40) + 30;
  if (density === 'medium') return Math.floor(Math.random() * 20) + 10;
  return Math.floor(Math.random() * 8) + 1;
};

let simulatorInterval = null;

const startCrowdSimulator = (io) => {
  const interval = parseInt(process.env.CROWD_SIM_INTERVAL_MS) || 5000;

  console.log(`🎯 Crowd simulator started (every ${interval / 1000}s)`);

  simulatorInterval = setInterval(async () => {
    const hour = new Date().getHours();
    const nodeIds = Object.keys(NODE_NAMES);
    
    const updates = {};

    for (const nodeId of nodeIds) {
      const density = getRealisticDensity(nodeId, hour);
      const personCount = densityToCount(density);

      // Save to DB (only save 30% of the time to avoid DB bloat — analytics server handles history)
      if (Math.random() < 0.3) {
        await CrowdReading.create({
          nodeId,
          nodeName: NODE_NAMES[nodeId],
          density,
          personCount,
          source: 'simulated',
          floor: nodeId === 'fob' ? 1 : 0
        });
      }

      updates[nodeId] = { density, personCount, timestamp: new Date() };
    }

    // Broadcast all updates at once
    io.emit('crowd:update', updates);

  }, interval);

  return simulatorInterval;
};

const stopCrowdSimulator = () => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    console.log('🛑 Crowd simulator stopped');
  }
};

module.exports = { startCrowdSimulator, stopCrowdSimulator };
