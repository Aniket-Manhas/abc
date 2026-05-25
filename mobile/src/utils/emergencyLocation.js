import * as Location from 'expo-location';

const PLACEHOLDER_VALUE = '';

/**
 * Fetches the device's current GPS fix for emergency reporting.
 * @returns {Promise<{ lat: number, lng: number, accuracy: number } | null>}
 */
export async function getDeviceGps() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      maximumAge: 10000,
      timeout: 15000,
    });

    const { latitude, longitude, accuracy } = loc.coords;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return null;
    }

    return {
      lat: latitude,
      lng: longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
    };
  } catch (e) {
    console.warn('Emergency GPS unavailable:', e?.message || e);
    return null;
  }
}

/**
 * Builds alert location payload: landmark when selected, otherwise GPS for admins.
 */
export async function resolveEmergencyLocation({ selectedNodeId, graphData }) {
  const gps = await getDeviceGps();
  const hasLandmark =
    selectedNodeId &&
    selectedNodeId !== PLACEHOLDER_VALUE &&
    graphData?.nodes?.[selectedNodeId];

  if (hasLandmark) {
    const node = graphData.nodes[selectedNodeId];
    const floor =
      node.floor !== undefined && node.floor !== null ? node.floor : null;

    return {
      nodeId: selectedNodeId,
      nodeName: node.name,
      floor,
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      accuracy: gps?.accuracy ?? null,
      locationSource: gps ? 'landmark_and_gps' : 'landmark_only',
    };
  }

  if (gps) {
    return {
      nodeId: 'gps',
      nodeName: 'GPS location (landmark not selected)',
      floor: null,
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy,
      locationSource: 'gps_only',
    };
  }

  return {
    nodeId: 'unknown',
    nodeName: 'Location unavailable — enable GPS or select a landmark',
    floor: null,
    lat: null,
    lng: null,
    accuracy: null,
    locationSource: 'unknown',
  };
}

export function canSendEmergency(locationPayload) {
  const hasGps =
    locationPayload.lat != null && locationPayload.lng != null;
  const hasLandmark =
    locationPayload.locationSource === 'landmark_only' ||
    locationPayload.locationSource === 'landmark_and_gps';
  return hasGps || hasLandmark;
}

export { PLACEHOLDER_VALUE };
