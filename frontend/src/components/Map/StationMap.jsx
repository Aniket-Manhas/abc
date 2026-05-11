import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSocket } from '../../contexts/SocketContext';

const TYPE_COLORS = {
  gate:         '#3b82f6',
  platform:     '#7c3aed',
  platform_zone:'#a855f7',
  ticket:       '#f59e0b',
  concourse:    '#06b6d4',
  waiting:      '#10b981',
  bridge:       '#8b5cf6',
  lift:         '#06d6a0',
  stairs:       '#94a3b8',
  ramp:         '#22d3ee',
  food:         '#f97316',
  restroom:     '#64748b',
  medical:      '#ef4444',
  inquiry:      '#60a5fa',
  atm:          '#fbbf24',
  boundary:     'transparent',
};

const CROWD_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

export default function StationMap({
  stationGeo,
  graphData,
  routeCoords = null,
  onNodeClick = null,
  selectedSource = null,
  selectedDest = null,
  showCrowdHeatmap = true,
  height = '500px',
  crowdDataOverride = null,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const { crowdData: socketCrowdData } = useSocket();
  const crowdData = crowdDataOverride || socketCrowdData;

  const LAT = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT) || 28.6430;
  const LNG = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG) || 77.2239;
  const ZOOM = parseFloat(import.meta.env.VITE_MAP_DEFAULT_ZOOM) || 17;

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0a0e1a' }
          }
        ],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center: [LNG, LAT],
      zoom: ZOOM,
      minZoom: 15,
      maxZoom: 21,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      if (!stationGeo) return;

      // Add station GeoJSON source
      map.addSource('station', { type: 'geojson', data: stationGeo });

      // Fill polygons by type
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'station',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': [
            'match', ['get', 'type'],
            'gate',         TYPE_COLORS.gate,
            'platform',     TYPE_COLORS.platform,
            'platform_zone',TYPE_COLORS.platform_zone,
            'ticket',       TYPE_COLORS.ticket,
            'concourse',    TYPE_COLORS.concourse,
            'waiting',      TYPE_COLORS.waiting,
            'bridge',       TYPE_COLORS.bridge,
            'lift',         TYPE_COLORS.lift,
            'stairs',       TYPE_COLORS.stairs,
            'ramp',         TYPE_COLORS.ramp,
            'food',         TYPE_COLORS.food,
            'restroom',     TYPE_COLORS.restroom,
            'medical',      TYPE_COLORS.medical,
            'inquiry',      TYPE_COLORS.inquiry,
            'atm',          TYPE_COLORS.atm,
            'boundary',     '#1a2540',
            '#1e293b'
          ],
          'fill-opacity': [
            'match', ['get', 'type'],
            'boundary', 0.3,
            0.6
          ],
        }
      });

      // Polygon borders
      map.addLayer({
        id: 'zones-outline',
        type: 'line',
        source: 'station',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': ['match', ['get', 'type'], 'boundary', '#1e3a5f', 'rgba(255,255,255,0.3)'],
          'line-width': ['match', ['get', 'type'], 'boundary', 2, 1],
        }
      });

      // Zone labels
      map.addLayer({
        id: 'zones-label',
        type: 'symbol',
        source: 'station',
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 11,
          'text-max-width': 8,
          'text-anchor': 'center',
        },
        paint: {
          'text-color': '#f1f5f9',
          'text-halo-color': '#0a0e1a',
          'text-halo-width': 1.5,
        }
      });

      // Node markers (clickable points)
      if (graphData) {
        addNodeMarkers(map, graphData, onNodeClick);
      }

      // Crowd heatmap circles
      if (showCrowdHeatmap) {
        addCrowdLayer(map, graphData, crowdData);
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [stationGeo]);

  // Update crowd heatmap when crowdData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !graphData) return;
    updateCrowdCircles(map, graphData, crowdData);
  }, [crowdData, graphData]);

  // Update route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateRouteLine(map, routeCoords);
  }, [routeCoords]);

  // Highlight selected nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !graphData) return;
    updateNodeHighlights(map, graphData, selectedSource, selectedDest, crowdData, onNodeClick);
  }, [selectedSource, selectedDest]);

  return (
    <div className="map-wrapper" style={{ height, position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      {showCrowdHeatmap && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.875rem',
          display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Crowd Density</div>
          {['low','medium','high'].map(d => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: CROWD_COLORS[d] }} />
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function addNodeMarkers(map, graphData, onNodeClick) {
  const { nodes } = graphData;
  Object.values(nodes).forEach(node => {
    const el = document.createElement('div');
    el.style.cssText = `
      width:14px;height:14px;border-radius:50%;
      background:${TYPE_COLORS[node.type] || '#64748b'};
      border:2px solid rgba(255,255,255,0.6);
      cursor:pointer;transition:transform 0.15s;
      box-shadow:0 0 6px rgba(0,0,0,0.5);
    `;
    el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.5)');
    el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');
    if (onNodeClick) el.addEventListener('click', () => onNodeClick(node));

    new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([node.lng, node.lat])
      .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false })
        .setHTML(`<div style="font-weight:600">${node.name}</div><div style="font-size:0.75rem;color:#94a3b8;margin-top:4px">Floor ${node.floor} · ${node.type}</div>`))
      .addTo(map);
  });
}

function addCrowdLayer(map, graphData, crowdData) {
  if (!graphData) return;
  const { nodes } = graphData;
  const features = Object.values(nodes).map(node => {
    const density = (crowdData[node.id] && (crowdData[node.id].density || crowdData[node.id])) || 'low';
    return {
      type: 'Feature',
      properties: { nodeId: node.id, density },
      geometry: { type: 'Point', coordinates: [node.lng, node.lat] }
    };
  });

  if (map.getSource('crowd-circles')) {
    map.getSource('crowd-circles').setData({ type: 'FeatureCollection', features });
  } else {
    map.addSource('crowd-circles', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({
      id: 'crowd-circles',
      type: 'circle',
      source: 'crowd-circles',
      paint: {
        'circle-radius': [
          'match', ['get', 'density'],
          'high', 20, 'medium', 14, 9
        ],
        'circle-color': [
          'match', ['get', 'density'],
          'high', CROWD_COLORS.high, 'medium', CROWD_COLORS.medium, CROWD_COLORS.low
        ],
        'circle-opacity': ['match', ['get', 'density'], 'high', 0.35, 'medium', 0.25, 0.15],
        'circle-stroke-color': [
          'match', ['get', 'density'],
          'high', CROWD_COLORS.high, 'medium', CROWD_COLORS.medium, CROWD_COLORS.low
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.6,
      }
    }, 'zones-label');
  }
}

function updateCrowdCircles(map, graphData, crowdData) {
  if (!graphData || !map.getSource('crowd-circles')) return;
  const { nodes } = graphData;
  const features = Object.values(nodes).map(node => {
    const entry = crowdData[node.id];
    const density = entry ? (typeof entry === 'string' ? entry : entry.density) : 'low';
    return {
      type: 'Feature',
      properties: { nodeId: node.id, density },
      geometry: { type: 'Point', coordinates: [node.lng, node.lat] }
    };
  });
  map.getSource('crowd-circles').setData({ type: 'FeatureCollection', features });
}

function updateRouteLine(map, routeCoords) {
  const routeData = {
    type: 'FeatureCollection',
    features: routeCoords ? [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: routeCoords }
    }] : []
  };

  if (map.getSource('route')) {
    map.getSource('route').setData(routeData);
  } else if (routeCoords) {
    map.addSource('route', { type: 'geojson', data: routeData });
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#3b82f6', 'line-width': 10, 'line-opacity': 0.2 }
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-dasharray': [2, 1.5],
      }
    });
  }
}

function updateNodeHighlights(map, graphData, selectedSource, selectedDest, crowdData, onNodeClick) {
  // Just re-render crowd circles — node highlights are done via markers
}
