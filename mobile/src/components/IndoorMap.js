/**
 * IndoorMap.js
 * Renders the indoor floor plan from GeoJSON — room polygons, boundaries,
 * computed route polyline, and user position dot.
 *
 * Mirrors the behaviour of indoor navigation/frontend/src/pages/IndoorNav.jsx
 * but adapted for React Native + react-native-svg + PanResponder gestures.
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, useWindowDimensions, PanResponder, Text,
} from 'react-native';
import Svg, {
  G, Polygon, Path, Polyline, Circle, Text as SvgText,
} from 'react-native-svg';
import { colors } from '../theme';

// ── Projection helpers (ported from geoProject.js) ─────────────────
const DEG = Math.PI / 180;

function visitCoords(coords, fn) {
  if (typeof coords[0] === 'number') {
    fn(coords[0], coords[1]);
  } else {
    for (const c of coords) visitCoords(c, fn);
  }
}

function computeBounds(geojson) {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  for (const f of (geojson.features || [])) {
    if (!f.geometry) continue;
    visitCoords(f.geometry.coordinates, (lng, lat) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  }
  const width = maxLng - minLng || 1e-9;
  const height = maxLat - minLat || 1e-9;
  return { minLng, maxLng, minLat, maxLat, width, height };
}

function projectionParams(bounds, viewW, viewH, pad = 20) {
  const refLat = ((bounds.minLat + bounds.maxLat) / 2) * DEG;
  const mPerDegLng = 111320 * Math.cos(refLat);
  const mPerDegLat = 111320;
  const rangeX = bounds.width * mPerDegLng;
  const rangeY = bounds.height * mPerDegLat;
  const innerW = viewW - 2 * pad;
  const innerH = viewH - 2 * pad;
  const scale = Math.min(innerW / rangeX, innerH / rangeY);
  const offsetX = pad + (innerW - rangeX * scale) / 2;
  const offsetY = pad + (innerH - rangeY * scale) / 2;
  return { mPerDegLng, mPerDegLat, rangeX, rangeY, scale, offsetX, offsetY };
}

function projectLngLat(lng, lat, bounds, viewW, viewH) {
  const p = projectionParams(bounds, viewW, viewH);
  const mx = (lng - bounds.minLng) * p.mPerDegLng;
  const my = (lat - bounds.minLat) * p.mPerDegLat;
  const x = p.offsetX + mx * p.scale;
  const y = p.offsetY + (p.rangeY - my) * p.scale;
  return [x, y];
}

function roomColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  // Return an rgba string — HSL not directly supported in react-native-svg fill
  // We map hue to a pale fill using a fixed lightness band
  const hNorm = h / 360;
  // Simple HSL→RGB for pale tones (s=45%, l=82%)
  return hslToHex(h, 45, 82);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const VIEW_W = 1200;
const VIEW_H = 800;

// ── Main component ─────────────────────────────────────────────────
export default function IndoorMap({
  geojson,          // full GeoJSON object from /api/geojson
  routeCoords,      // [[lng, lat], ...] from /api/route
  userLngLat,       // [lng, lat] current user position
  onRoomTap,        // (roomId, roomName) => void
  outsideApproach,  // { pathToEntrance: [[lng,lat],...] } optional
  accessible,       // boolean — true = accessible route (ramps), false = standard (stairs ok)
}) {
  const { width: screenW } = useWindowDimensions();
  const [containerH, setContainerH] = useState(500);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panStateRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const lastDist = useRef(null);

  const bounds = useMemo(() =>
    geojson ? computeBounds(geojson) : null,
    [geojson]);

  const project = useCallback((lng, lat) => {
    if (!bounds) return [0, 0];
    return projectLngLat(lng, lat, bounds, VIEW_W, VIEW_H);
  }, [bounds]);

  // ── PanResponder — supports 1-finger pan and 2-finger pinch-zoom ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartRef.current = { ...panStateRef.current };
        lastDist.current = null;
      },
      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch zoom
          const t1 = touches[0], t2 = touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          if (lastDist.current !== null) {
            const delta = dist - lastDist.current;
            const newZoom = Math.min(8, Math.max(0.35, zoomRef.current + delta * 0.006));
            zoomRef.current = newZoom;
            setZoom(newZoom);
          }
          lastDist.current = dist;
        } else {
          // Pan
          const scaleX = VIEW_W / screenW;
          const scaleY = VIEW_H / containerH;
          const newX = panStartRef.current.x + gs.dx * scaleX;
          const newY = panStartRef.current.y + gs.dy * scaleY;
          panStateRef.current = { x: newX, y: newY };
          setPan(panStateRef.current);
          lastDist.current = null;
        }
      },
      onPanResponderRelease: () => { lastDist.current = null; },
    })
  ).current;

  if (!geojson || !bounds) {
    return (
      <View style={styles.emptyFull}>
        <Text style={styles.emptyText}>Loading floor plan…</Text>
      </View>
    );
  }

  const features = geojson.features || [];

  // Separate outside approach from indoor route
  const ap = outsideApproach?.pathToEntrance;
  const apLen = Array.isArray(ap) ? ap.length : 0;
  const indoorCoords = routeCoords && apLen > 1 ? routeCoords.slice(apLen - 1) : routeCoords;
  const outsideCoords = apLen > 1 ? ap : null;

  const toPoints = (coordArr) =>
    (coordArr || []).map(([lng, lat]) => project(lng, lat).join(',')).join(' ');

  const [userX, userY] = userLngLat ? project(userLngLat[0], userLngLat[1]) : [0, 0];

  return (
    <View
      style={styles.mapWrapFull}
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
      {...panResponder.panHandlers}
    >
      <Svg
        width={screenW}
        height={containerH}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        <G transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>

          {/* Boundary outlines */}
          {features.map((f, i) => {
            if (f.properties?.type !== 'boundary') return null;
            if (f.geometry?.type !== 'Polygon') return null;
            const ring = f.geometry.coordinates[0];
            const d = ring
              .map(([lng, lat], j) => {
                const [x, y] = project(lng, lat);
                return `${j === 0 ? 'M' : 'L'}${x} ${y}`;
              })
              .join(' ') + 'Z';
            return (
              <Path
                key={`b-${i}`}
                d={d}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2 / zoom}
              />
            );
          })}

          {/* Room polygons */}
          {features.map((f, i) => {
            if (f.properties?.type !== 'room') return null;
            if (f.geometry?.type !== 'Polygon') return null;
            const ring = f.geometry.coordinates[0];
            const pts = ring.map(([lng, lat]) => project(lng, lat).join(',')).join(' ');
            const name = f.properties.name || '';
            const roomId = f.properties.roomId || f.properties.name;
            const [cx, cy] = project(
              ring.reduce((s, c) => s + c[0], 0) / ring.length,
              ring.reduce((s, c) => s + c[1], 0) / ring.length,
            );
            return (
              <G key={`r-${i}`} onPress={() => onRoomTap?.(roomId, name)}>
                <Polygon
                  points={pts}
                  fill={roomColor(name)}
                  stroke="#334155"
                  strokeWidth={1 / zoom}
                />
                {name.length > 0 && (
                  <SvgText
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    fill="#1e293b"
                    fontSize={14 / zoom}
                    fontWeight="600"
                  >
                    {name.length > 16 ? name.slice(0, 15) + '…' : name}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* Entry / Door markers */}
          {features.map((f, i) => {
            if (f.properties?.type === 'node' && ['door', 'entrance'].includes(f.properties?.nodeType)) {
              if (f.geometry?.type !== 'Point') return null;
              const [x, y] = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
              return (
                <Circle
                  key={`dr-${i}`}
                  cx={x}
                  cy={y}
                  r={3 / zoom}
                  fill="#eab308"
                  stroke="#854d0e"
                  strokeWidth={1 / zoom}
                />
              );
            }
            return null;
          })}

          {/* Outside approach path (amber) */}
          {outsideCoords && outsideCoords.length > 1 && (
            <Polyline
              points={toPoints(outsideCoords)}
              fill="none"
              stroke="#d97706"
              strokeWidth={5 / zoom}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Indoor route — green = accessible/ramp, blue = standard */}
          {indoorCoords && indoorCoords.length > 1 && (
            <Polyline
              points={toPoints(indoorCoords)}
              fill="none"
              stroke={accessible ? '#16a34a' : '#2563eb'}
              strokeWidth={4 / zoom}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={accessible ? undefined : undefined}
            />
          )}

          {/* User position dot */}
          {userLngLat && (
            <>
              <Circle cx={userX} cy={userY} r={18 / zoom} fill="rgba(37,99,235,0.15)" />
              <Circle cx={userX} cy={userY} r={10 / zoom} fill="#2563eb" stroke="#fff" strokeWidth={2.5 / zoom} />
              {/* Heading dot */}
              <Circle cx={userX} cy={userY - 13 / zoom} r={3 / zoom} fill="#fff" opacity={0.7} />
            </>
          )}
        </G>
      </Svg>

      {/* Route legend — shown only when a route is active */}
      {routeCoords && routeCoords.length > 1 && (
        <View style={styles.legend} pointerEvents="none">
          {outsideApproach && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#d97706' }]} />
              <Text style={styles.legendText}>🏛️ Outside approach</Text>
            </View>
          )}
        </View>
      )}

      {/* Gesture hint */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>Pan: drag  ·  Zoom: pinch  ·  Tap room to navigate</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapFull: {
    flex: 1,
    backgroundColor: '#f8f6f0',
    overflow: 'hidden',
  },
  emptyFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1d',
  },
  emptyText: { color: '#888', fontSize: 14 },

  legend: {
    position: 'absolute',
    top: 90,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: '#334155', fontWeight: '600' },

  hint: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 10,
    color: '#64748b',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },
});
