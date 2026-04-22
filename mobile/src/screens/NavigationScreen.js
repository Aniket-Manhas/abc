/**
 * NavigationScreen.js
 * Indoor Navigation — mirrors indoor navigation/frontend/IndoorNav.jsx
 * but built for React Native.
 *
 * Data flow:
 *   1. On mount: fetch GeoJSON from indoor nav backend /api/geojson
 *   2. Extract room list from GeoJSON features (type === "room")
 *   3. User selects destination room via picker (or taps room on map)
 *   4. Backend computes route: GET /api/route?from=lat,lng&to=roomId
 *   5. Route coordinates [[lng,lat],...] passed to IndoorMap
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';

import { indoorNavAPI } from '../services/api';
import { useSocket }       from '../contexts/SocketContext';
import IndoorMap           from '../components/IndoorMap';
import CrowdBadge          from '../components/CrowdBadge';
import { colors, spacing, radius } from '../theme';

// Default position — College Entrance
const DEFAULT_LNGLAT = [74.81924, 32.81261];

export default function NavigationScreen() {
  const { crowdData, emitLocation } = useSocket();

  // Track position used for last route fetch (to gate re-fetches by distance)
  const lastRoutePosRef = useRef(null);
  // Debounce timer for route re-fetch
  const routeDebounceRef = useRef(null);

  // ── GeoJSON map data ───────────────────────────────────────
  const [geojson,      setGeojson]      = useState(null);
  const [loadingMap,   setLoadingMap]   = useState(true);
  const [mapError,     setMapError]     = useState('');

  // ── User position ──────────────────────────────────────────
  const [userLngLat,   setUserLngLat]   = useState(DEFAULT_LNGLAT);
  const [useLiveGPS,   setUseLiveGPS]   = useState(true); // auto-start
  const [gpsStatus,    setGpsStatus]    = useState('Acquiring GPS…');
  const locationSub = useRef(null);

  // ── Route state ────────────────────────────────────────────
  const [destination,    setDestination]    = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [accessible,     setAccessible]     = useState(false);
  const [routeCoords,    setRouteCoords]    = useState(null);
  const [outsideApproach,setOutsideApproach] = useState(null);
  const [routeLoading,   setRouteLoading]   = useState(false);
  const [routeError,     setRouteError]     = useState('');
  const [routeDistance,  setRouteDistance]  = useState(null);

  // ── Tab ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('map'); // map | crowd

  // ── Load GeoJSON on mount ──────────────────────────────────
  useEffect(() => {
    setLoadingMap(true);
    setMapError('');
    indoorNavAPI.getGeoJson()
      .then(r => setGeojson(r.data))
      .catch(e => setMapError('Could not load station floor plan. Is the indoor nav server running on port 4000?'))
      .finally(() => setLoadingMap(false));
  }, []);

  // ── GPS toggle ─────────────────────────────────────────────
  useEffect(() => {
    if (!useLiveGPS) {
      locationSub.current?.remove();
      locationSub.current = null;
      setGpsStatus('');
      return;
    }
    (async () => {
      setGpsStatus('Requesting permission…');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Permission denied');
        setUseLiveGPS(false);
        return;
      }
      setGpsStatus('Acquiring GPS…');
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        loc => {
          const { longitude, latitude, accuracy } = loc.coords;
          const newPos = [longitude, latitude];
          setUserLngLat(newPos);
          setGpsStatus(`${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy || 0)}m)`);

          // Broadcast location via WebSocket for real-time admin tracking
          emitLocation({
            lng: longitude,
            lat: latitude,
            accuracy,
            floor: 0,
            timestamp: Date.now(),
          });

          // Trigger route re-fetch continuously as user moves (safely debounced to 300ms below)
          if (destination) {
            triggerRouteFetch(newPos);
          }
        }
      );
    })();
    return () => { locationSub.current?.remove(); locationSub.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLiveGPS]);

  // ── Distance-gated route trigger ───────────────────────────
  const triggerRouteFetch = useCallback((fromPos) => {
    lastRoutePosRef.current = fromPos;
    clearTimeout(routeDebounceRef.current);
    routeDebounceRef.current = setTimeout(() => fetchRoute(fromPos), 300);
  }, [fetchRoute]);

  // ── Compute route ──────────────────────────────────────────
  const fetchRoute = useCallback(async (overridePos) => {
    if (!destination) return;
    setRouteLoading(true);
    setRouteError('');
    setRouteDistance(null);
    try {
      const pos = overridePos || userLngLat;
      const [lng, lat] = pos;
      const res = await indoorNavAPI.getRoute(lat, lng, destination, accessible);
      const data = res.data;
      if (!data.ok) throw new Error(data.error || 'Route not found');
      const coords = data.coordinates || data.path || [];
      setRouteCoords(coords);
      setOutsideApproach(data.outsideApproach || null);
      if (data.totalWeight) setRouteDistance(Math.round(data.totalWeight));
      if (!overridePos) lastRoutePosRef.current = userLngLat; // track for GPS updates
    } catch (e) {
      setRouteError(e.message || 'Route calculation failed');
    } finally {
      setRouteLoading(false);
    }
  }, [destination, userLngLat, accessible]);

  // Auto-recalculate when destination or accessibility mode changes (not on GPS — handled above)
  useEffect(() => {
    if (destination) {
      lastRoutePosRef.current = null; // reset threshold so first GPS position triggers fetch
      fetchRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, accessible]);

  // Rooms extracted from GeoJSON
  const rooms = React.useMemo(() => {
    if (!geojson) return [];
    return (geojson.features || [])
      .filter(f => f.properties?.type === 'room')
      .map(f => ({
        id:   f.properties.roomId || f.properties.name,
        name: f.properties.name  || f.properties.roomId,
      }))
      .filter(r => r.id);
  }, [geojson]);

  // Crowd-aware room list for the crowd tab
  const crowdRooms = rooms.slice(0, 20);

  const handleRoomTap = (roomId, roomName) => {
    setDestination(roomId);
    setDestinationName(roomName);
  };

  // ── Render ─────────────────────────────────────────────────
  if (loadingMap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentSaffron} />
        <Text style={styles.loadingText}>Loading indoor map…</Text>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>🏢</Text>
        <Text style={styles.errorText}>{mapError}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setLoadingMap(true);
            setMapError('');
            indoorNavAPI.getGeoJson()
              .then(r => setGeojson(r.data))
              .catch(() => setMapError('Still offline. Check indoor nav server.'))
              .finally(() => setLoadingMap(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasRoute = routeCoords && routeCoords.length > 1;

  return (
    <View style={styles.screen}>

      {/* ── Control panel ── */}
      <View style={styles.panel}>

        {/* Destination picker */}
        <Text style={styles.label}>Destination</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={destination}
            onValueChange={v => {
              const room = rooms.find(r => r.id === v);
              setDestination(v);
              setDestinationName(room?.name || v);
            }}
            style={styles.picker}
            mode="dropdown"
            dropdownIconColor={colors.textMuted}
          >
            <Picker.Item label="— Select a room —" value="" />
            {rooms.map(r => (
              <Picker.Item key={r.id} label={r.name} value={r.id} />
            ))}
          </Picker>
        </View>

        {/* GPS + Accessible row */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>🛰️ Live GPS</Text>
            <Switch
              value={useLiveGPS}
              onValueChange={setUseLiveGPS}
              trackColor={{ true: colors.accentBlue, false: colors.border }}
              thumbColor={useLiveGPS ? '#fff' : colors.textMuted}
            />
          </View>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>♿ Accessible</Text>
            <Switch
              value={accessible}
              onValueChange={setAccessible}
              trackColor={{ true: colors.accentBlue, false: colors.border }}
              thumbColor={accessible ? '#fff' : colors.textMuted}
            />
          </View>
        </View>

        {/* GPS status / coord display */}
        {useLiveGPS && gpsStatus ? (
          <Text style={styles.gpsStatus}>📍 {gpsStatus}</Text>
        ) : null}

        {/* Route info bar */}
        {hasRoute && (
          <View style={styles.routeInfo}>
            <Text style={styles.routeInfoText}>
              🧭 Route to <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{destinationName}</Text>
              {routeDistance ? `  ·  ~${routeDistance} m` : ''}
              {outsideApproach ? '  ·  🏛️ Outside approach included' : ''}
            </Text>
          </View>
        )}

        {/* Find Route / Recalculate button */}
        <TouchableOpacity
          style={[styles.findBtn, (!destination || routeLoading) && styles.findBtnDisabled]}
          onPress={fetchRoute}
          disabled={!destination || routeLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.findBtnText}>
            {routeLoading ? '⏳ Calculating…' : hasRoute ? '🔄 Recalculate' : '🧭 Find Route'}
          </Text>
        </TouchableOpacity>

        {routeError ? <Text style={styles.routeError}>⚠️ {routeError}</Text> : null}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {[
          { key: 'map',   label: '🗺️ Map'  },
          { key: 'crowd', label: '👥 Crowd' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Map tab ── */}
      {activeTab === 'map' && (
        <IndoorMap
          geojson={geojson}
          routeCoords={routeCoords}
          userLngLat={userLngLat}
          onRoomTap={handleRoomTap}
          outsideApproach={outsideApproach}
          accessible={accessible}
        />
      )}

      {/* ── Crowd tab ── */}
      {activeTab === 'crowd' && (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {crowdRooms.length === 0 ? (
            <Text style={styles.emptyText}>No rooms loaded</Text>
          ) : (
            crowdRooms.map(room => {
              const entry = crowdData[room.id];
              const density = entry
                ? (typeof entry === 'string' ? entry : entry.density)
                : 'low';
              return (
                <View key={room.id} style={styles.crowdRow}>
                  <Text style={styles.crowdName}>{room.name}</Text>
                  <CrowdBadge density={density} />
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgPrimary },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorIcon:   { fontSize: 40, marginBottom: 8 },
  errorText:   { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  retryBtn:    { marginTop: spacing.md, backgroundColor: colors.accentBlue, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: 10 },
  retryText:   { color: '#fff', fontWeight: '700' },

  panel: {
    backgroundColor: colors.bgSecondary,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  label:     { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pickerBox: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  picker: { color: colors.textPrimary, height: 44 },

  toggleRow: { flexDirection: 'row', gap: spacing.md },
  toggleItem:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               backgroundColor: colors.bgElevated, borderRadius: radius.md,
               paddingHorizontal: spacing.sm, paddingVertical: 6,
               borderWidth: 1, borderColor: colors.border },
  toggleLabel:{ fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  gpsStatus: { fontSize: 11, color: colors.textMuted, paddingLeft: 2 },

  routeInfo: {
    backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)',
  },
  routeInfoText: { fontSize: 12, color: colors.textSecondary },

  findBtn:         { backgroundColor: colors.accentBlue, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  findBtnDisabled: { backgroundColor: colors.bgElevated },
  findBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  routeError: { color: colors.crowdHigh, fontSize: 12 },

  tabBar:       { flexDirection: 'row', backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: colors.accentBlue },
  tabText:      { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive:{ color: colors.accentBlue },

  crowdRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  crowdName:  { color: colors.textSecondary, fontSize: 14 },
  emptyText:  { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
