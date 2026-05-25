# Indoor Navigation Backend (MERN)

Production-oriented Node.js/Express backend for indoor navigation with strict spatial rules:

- no routing through walls
- room -> door -> corridor flow enforced
- visibility checks before projection to corridor graph
- immutable base graph per request

## Structure

```
backend/
  data/sample-indoor.geojson   (optional legacy demo)
  ../college.geojson           (default campus dataset — loaded on startup)
  src/
    config/database.js
    models/
    routes/
    services/
      graphBuilder.js
      spatialEngine.js
      router.js
    utils/geo.js
    app.js
    server.js
```

## Run

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` (optional when no MongoDB)
4. `npm start`

On startup, if `../college.geojson` exists (project root), it is loaded automatically and the navigation graph is built from its `node` / `edge` / `egress_edge` features.

Override path with env: `COLLEGE_GEOJSON_PATH`.

When `MONGO_URI` is not set, service still runs using in-memory active map state.

## APIs

### `GET /api/geojson` (also `GET /geojson` for direct backend access)

Returns the active map GeoJSON (same as last load).

### `GET /api/map-status` (also `GET /map-status`)

Returns `{ loaded, mapId, name }`.

### `POST /api/load-map` (also `POST /load-map`)

Supports:
- JSON body `{ "geojson": { ...FeatureCollection... } }`
- JSON body `{ "useCollege": true }` (reads `college.geojson` from project root or `COLLEGE_GEOJSON_PATH`)
- JSON body `{ "useSample": true }` (legacy sample file)
- multipart upload with `file`

Optional fields:
- `mapId`
- `name`

### `POST /api/update-position` (also `POST /update-position`)

Body:
```json
{
  "userId": "u1",
  "lat": 32.81253,
  "lng": 74.81908,
  "floor": 0
}
```

### `GET /api/route?from=lat,lng&to=roomId&floor=0&accessible=true|false` (also `GET /route`)

Behavior:
- if `from` is inside a room: route starts from nearest room door
- if outside rooms: injects virtual start on nearest visible corridor edge
- A* route uses weighted edges (stairs > ramp/elevator > normal)
- `accessible=true` filters out non-accessible edges (stairs)

## Demo (college.geojson)

With the server running and `college.geojson` loaded:

`GET /route?from=32.812532,74.819196&to=server_room&floor=0`

## Legacy sample

1. `POST /load-map` with `{ "useSample": true }`
2. `GET /route?from=32.81253,74.81908&to=room_B&floor=0`

## Frontend (React)

See `../frontend` — Vite + Mapbox outdoor view and a separate SVG indoor page. Create `frontend/.env` with `VITE_MAPBOX_ACCESS_TOKEN` (same value as `MAPBOX_ACCESS_TOKEN` in the project `.env`).
