import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Jammu Tawi Railway Station coordinates
const JAMMU_TAWI = { lng: 74.8703, lat: 32.7330 };

// Station SVG marker element
function createStationMarker(onClick) {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="station-marker" title="Jammu Tawi Railway Station">
      <div class="station-marker__pulse"></div>
      <div class="station-marker__icon">🚉</div>
    </div>
  `;
  el.style.cursor = 'pointer';
  el.addEventListener('click', onClick);
  return el;
}

export default function OutdoorMap({ onStationClick, routeResult = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Free OpenStreetMap raster tiles — CartoDB Dark Matter style
      style: {
        version: 8,
        sources: {
          'osm-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#0c0c0e' } },
          { id: 'osm-dark', type: 'raster', source: 'osm-dark', paint: { 'raster-opacity': 0.9, 'raster-brightness-min': 0.05, 'raster-contrast': 0.1 } },
        ],
      },
      center: [JAMMU_TAWI.lng, JAMMU_TAWI.lat],
      zoom: 13,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      // Add station marker
      const el = createStationMarker(() => onStationClick?.());
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([JAMMU_TAWI.lng, JAMMU_TAWI.lat])
        .addTo(map);
      markerRef.current = marker;

      // Inject marker CSS
      const style = document.createElement('style');
      style.textContent = `
        .station-marker {
          position: relative;
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
        }
        .station-marker__pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #e8a020;
          animation: station-pulse 2.2s ease-out infinite;
        }
        .station-marker__pulse::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 1.5px solid rgba(232,160,32,0.35);
          animation: station-pulse 2.2s ease-out infinite 0.4s;
        }
        @keyframes station-pulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .station-marker__icon {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #232326, #0c0c0e);
          border: 2px solid #e8a020;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          box-shadow: 0 0 20px rgba(232,160,32,0.4), 0 4px 12px rgba(0,0,0,0.6);
          transition: transform 0.18s, box-shadow 0.18s;
          position: relative; z-index: 1;
        }
        .station-marker:hover .station-marker__icon {
          transform: scale(1.12);
          box-shadow: 0 0 32px rgba(232,160,32,0.6), 0 4px 16px rgba(0,0,0,0.7);
        }
        .station-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%; transform: translateX(-50%);
          background: #1a1a1d;
          color: #f2f0eb;
          border: 1px solid rgba(232,160,32,0.3);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-family: 'Space Grotesk', sans-serif;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
      `;
      document.head.appendChild(style);

      // Add nearby city markers
      addCityMarkers(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );
}

function addCityMarkers(map) {
  const places = [
    { name: 'Jammu City', coords: [74.857, 32.733], icon: '🏙️' },
    { name: 'Katra (Vaishno Devi)', coords: [74.931, 32.989], icon: '⛰️' },
    { name: 'Udhampur', coords: [75.134, 32.916], icon: '🏘️' },
    { name: 'Pathankot', coords: [75.652, 32.275], icon: '🚉' },
  ];

  places.forEach(place => {
    const el = document.createElement('div');
    el.innerHTML = `<span style="font-size:1.1rem;cursor:default;" title="${place.name}">${place.icon}</span>`;
    el.title = place.name;

    new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(place.coords)
      .setPopup(
        new maplibregl.Popup({ offset: 16, closeButton: false })
          .setHTML(`<strong>${place.name}</strong>`)
      )
      .addTo(map);
  });
}
