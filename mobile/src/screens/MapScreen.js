import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { indoorNavAPI } from '../services/api';
import IndoorMap from '../components/IndoorMap';
import { useSocket } from '../contexts/SocketContext';
import { colors, spacing, radius } from '../theme';

const STATION_LAT  = 32.81261;
const STATION_LNG  = 74.81924;
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW5pa2V0bWFuaGFzODAxIiwiYSI6ImNtOGxyNDNldDA4NDIyanBsYnFuczE5cjcifQ.7HPta07dHTFnFsGDrrih1g';

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#1a1a1d; }
    .leaflet-control-attribution { font-size:8px !important; }

    /* ── Search box ── */
    #search-wrap {
      position:absolute; top:100px; left:12px; right:72px; z-index:1000;
    }
    #search-input {
      width:100%; padding:10px 14px;
      border-radius:12px; border:none; outline:none;
      font-size:14px; background:rgba(26,26,29,0.94); color:#fff;
      box-shadow:0 4px 16px rgba(0,0,0,0.4);
    }
    #search-input::placeholder { color:#888; }
    #search-results {
      background:rgba(30,30,34,0.97); border-radius:10px;
      margin-top:4px; max-height:200px; overflow-y:auto;
      box-shadow:0 4px 16px rgba(0,0,0,0.5);
    }
    .result-item {
      padding:10px 14px; cursor:pointer; font-size:13px; color:#ddd;
      border-bottom:1px solid rgba(255,255,255,0.06);
    }
    .result-item:last-child { border-bottom:none; }
    .result-item:hover { background:rgba(255,255,255,0.07); }
    .result-place { font-weight:600; color:#fff; }
    .result-sub   { font-size:11px; color:#888; margin-top:2px; }

    /* ── Locate button ── */
    #locate-btn {
      position:absolute; top:100px; right:12px; z-index:1000;
      width:44px; height:44px; border-radius:12px;
      background:rgba(26,26,29,0.94); border:none; cursor:pointer;
      font-size:20px; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); color:#fff;
    }
    #locate-btn:active { background:rgba(232,160,32,0.3); }

    /* ── Route info pill ── */
    #route-info {
      display:none; position:absolute; bottom:16px; left:12px; right:12px; z-index:1000;
      background:rgba(26,26,29,0.94); border-radius:12px;
      padding:10px 14px; text-align:center; color:#fff; font-size:13px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4);
    }
    #route-info span { color:#e8a020; font-weight:700; }

    /* ── Loading ── */
    #map-loading {
      position:absolute; inset:0; z-index:2000; background:#1a1a1d;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
    }
    .spinner {
      width:36px; height:36px; border:3px solid rgba(232,160,32,0.2);
      border-top-color:#e8a020; border-radius:50%; animation:spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
    #map-loading p { color:#888; font-size:13px; font-family:sans-serif; }
  </style>
</head>
<body>

  <div id="map-loading">
    <div class="spinner"></div>
    <p>Loading map…</p>
  </div>

  <div id="map"></div>

  <div id="search-wrap">
    <input id="search-input" type="text" placeholder="🔍  Search places…" autocomplete="off"/>
    <div id="search-results"></div>
  </div>

  <button id="locate-btn" title="My location">📍</button>
  <div id="route-info"></div>

  <script>
    var MAPBOX_TOKEN = '${MAPBOX_TOKEN}';
    var STATION = [${STATION_LAT}, ${STATION_LNG}];

    /* ── Map init ── */
    var map = L.map('map', { center: STATION, zoom: 16, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=' + MAPBOX_TOKEN,
      { maxZoom:20, tileSize:512, zoomOffset:-1, attribution:'© Mapbox © OSM' }
    ).addTo(map);

    map.whenReady(function() {
      document.getElementById('map-loading').style.display = 'none';
      if (window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    });

    /* ── Station marker ── */
    var stationIcon = L.divIcon({
      className:'',
      html:'<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚉</div>',
      iconSize:[36,36], iconAnchor:[18,18], popupAnchor:[0,-20],
    });
    L.marker(STATION, { icon: stationIcon })
      .addTo(map)
      .bindPopup('<b style="font-size:13px">Jammu Tawi Station</b><br/><span style="font-size:11px;color:#666">Switch to Indoor to navigate inside</span>');

    /* ── User location state ── */
    var userMarker = null, userCircle = null, destMarker = null, routeLine = null;

    function setUserPos(lat, lng, acc) {
      var latlng = [lat, lng];
      if (userMarker) { userMarker.setLatLng(latlng); userCircle.setLatLng(latlng).setRadius(acc || 20); }
      else {
        userCircle = L.circle(latlng, { radius: acc || 20, color:'#2563eb', fillColor:'#2563eb', fillOpacity:0.15, weight:1 }).addTo(map);
        var uIcon = L.divIcon({
          className:'',
          html:'<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(37,99,235,0.6)"></div>',
          iconSize:[16,16], iconAnchor:[8,8],
        });
        userMarker = L.marker(latlng, { icon: uIcon, zIndexOffset: 100 }).addTo(map);
      }
      return latlng;
    }

    /* ── Draw route (straight line w/ walking directions feel) ── */
    function drawRoute(fromLat, fromLng, toLat, toLng, placeName) {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      routeLine = L.polyline([[fromLat, fromLng],[toLat, toLng]], {
        color:'#2563eb', weight:5, opacity:0.85,
        dashArray: null,
      }).addTo(map);

      // Fetch real walking route from Mapbox Directions API
      var url = 'https://api.mapbox.com/directions/v5/mapbox/walking/'
        + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat
        + '?geometries=geojson&access_token=' + MAPBOX_TOKEN;

      fetch(url).then(function(r){ return r.json(); }).then(function(data) {
        if (data.routes && data.routes.length > 0) {
          if (routeLine) map.removeLayer(routeLine);
          var coords = data.routes[0].geometry.coordinates.map(function(c){ return [c[1], c[0]]; });
          routeLine = L.polyline(coords, { color:'#2563eb', weight:5, opacity:0.85 }).addTo(map);
          map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });

          var dist = data.routes[0].distance;
          var dur  = Math.round(data.routes[0].duration / 60);
          var distTxt = dist > 1000 ? (dist/1000).toFixed(1)+'km' : Math.round(dist)+'m';
          showRouteInfo('\uD83D\uDEB6 ' + distTxt + ' · <span>' + dur + ' min walk</span> to ' + placeName);
        }
      }).catch(function(e) {
        map.fitBounds(L.latLngBounds([[fromLat,fromLng],[toLat,toLng]]), { padding:[60,60] });
        showRouteInfo('Route to <span>' + placeName + '</span>');
      });
    }

    function showRouteInfo(html) {
      var el = document.getElementById('route-info');
      el.innerHTML = html + ' &nbsp;<span style="cursor:pointer;opacity:0.5" onclick="clearRoute()">✕</span>';
      el.style.display = 'block';
    }

    function clearRoute() {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      document.getElementById('route-info').style.display = 'none';
    }

    /* ── Locate button (Delegated to Native) ── */
    document.getElementById('locate-btn').addEventListener('click', function() {
      this.textContent = '⏳';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION', flyTo: true }));
      }
    });

    /* ── Native callback for location ── */
    window.updateLocationFromNative = function(lat, lng, acc, fly) {
      document.getElementById('locate-btn').textContent = '📍';
      var latlng = setUserPos(lat, lng, acc);
      if (fly) {
        map.flyTo(latlng, 17, { duration: 1.2 });
      }
    };

    window.locationErrorFromNative = function(err) {
      document.getElementById('locate-btn').textContent = '📍';
      alert('Could not get location: ' + err);
    };

    /* ── Search (Mapbox Geocoding API) ── */
    var searchTimer = null;
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');

    input.addEventListener('input', function() {
      clearTimeout(searchTimer);
      var q = input.value.trim();
      results.innerHTML = '';
      if (q.length < 2) return;
      searchTimer = setTimeout(function() { geocode(q); }, 350);
    });

    function geocode(q) {
      var url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
        + encodeURIComponent(q)
        + '.json?proximity=' + STATION[1] + ',' + STATION[0]
        + '&access_token=' + MAPBOX_TOKEN + '&limit=5&language=en';
      fetch(url).then(function(r){ return r.json(); }).then(function(data) {
        results.innerHTML = '';
        (data.features || []).forEach(function(f) {
          var div = document.createElement('div');
          div.className = 'result-item';
          var place = f.text || f.place_name;
          var sub   = f.place_name.replace(place, '').replace(/^,\s*/, '');
          div.innerHTML = '<div class="result-place">' + place + '</div>'
            + (sub ? '<div class="result-sub">' + sub + '</div>' : '');
          div.addEventListener('click', function() {
            var c = f.center; // [lng, lat]
            input.value = place;
            results.innerHTML = '';
            input.blur();

            // Place destination marker
            if (destMarker) map.removeLayer(destMarker);
            var dIcon = L.divIcon({
              className:'',
              html:'<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">📍</div>',
              iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-28],
            });
            destMarker = L.marker([c[1], c[0]], { icon: dIcon }).addTo(map).bindPopup('<b>' + place + '</b>').openPopup();

            // If user location known → draw route; else just fly there
            if (userMarker) {
              var uPos = userMarker.getLatLng();
              drawRoute(uPos.lat, uPos.lng, c[1], c[0], place);
            } else {
              map.flyTo([c[1], c[0]], 15, { duration: 1.2 });
            }
          });
          results.appendChild(div);
        });
      }).catch(function(){});
    }

    // Close results on map click
    map.on('click', function() { results.innerHTML = ''; input.blur(); });

    // Auto-get location on load (silently via Native)
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION', flyTo: false }));
      }
    }, 1000);
  </script>
</body>
</html>
`;

export default function MapScreen() {
  const { crowdData } = useSocket();
  const [mode, setMode]         = useState('outdoor');
  const [geojson, setGeojson]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const webviewRef = useRef(null);

  useEffect(() => {
    indoorNavAPI.getGeoJson()
      .then(r  => setGeojson(r.data))
      .catch(err => console.warn('[Map] Indoor GeoJSON load failed:', err?.message || err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (mode === 'outdoor') setMapReady(false);
  }, [mode]);

  const handleWebViewMessage = async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      
      if (msg.type === 'MAP_READY') {
        setMapReady(true);
        console.log('[Map] Outdoor WebView map ready');
      } 
      
      else if (msg.type === 'REQUEST_LOCATION') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          webviewRef.current?.injectJavaScript(`window.locationErrorFromNative("Permission denied"); true;`);
          return;
        }
        
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude, accuracy } = loc.coords;
          webviewRef.current?.injectJavaScript(
            `window.updateLocationFromNative(${latitude}, ${longitude}, ${accuracy}, ${msg.flyTo}); true;`
          );
        } catch (err) {
          webviewRef.current?.injectJavaScript(`window.locationErrorFromNative("${err.message}"); true;`);
        }
      }
    } catch (_) {}
  };

  return (
    <View style={styles.screen}>

      {/* ── Outdoor map ── */}
      {mode === 'outdoor' && (
        <View style={StyleSheet.absoluteFill}>
          {!mapReady && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.accentSaffron} />
              <Text style={styles.loadingText}>Loading map…</Text>
            </View>
          )}
          <WebView
            ref={webviewRef}
            style={StyleSheet.absoluteFill}
            originWhitelist={['*']}
            source={{ html: LEAFLET_HTML }}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            onMessage={handleWebViewMessage}
            onError={(e) => console.warn('[Map WebView Error]', e.nativeEvent)}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            scrollEnabled={false}
            bounces={false}
          />
        </View>
      )}

      {/* ── Indoor SVG map ── */}
      {mode === 'indoor' && (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accentSaffron} />
            <Text style={styles.loadingText}>Loading station map…</Text>
          </View>
        ) : (
          <IndoorMap
            geojson={geojson}
            userLngLat={[STATION_LNG, STATION_LAT]}
          />
        )
      )}

      {/* ── Mode toggle ── */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'outdoor' && styles.toggleBtnActive]}
          onPress={() => setMode('outdoor')}
        >
          <Text style={[styles.toggleText, mode === 'outdoor' && styles.toggleTextActive]}>🌍 Outdoor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'indoor' && styles.toggleBtnActive]}
          onPress={() => setMode('indoor')}
        >
          <Text style={[styles.toggleText, mode === 'indoor' && styles.toggleTextActive]}>🏢 Indoor</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },

  toggleBar: {
    position: 'absolute', top: 45, right: 16, zIndex: 30,
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(26,26,29,0.92)',
    borderRadius: radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  toggleBtnActive:  { backgroundColor: colors.accentSaffron },
  toggleText:       { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: colors.bgPrimary },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10, backgroundColor: colors.bgPrimary,
    justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
  },
  loadingText: { color: colors.textMuted, fontSize: 14 },
});
