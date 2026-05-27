# 🧭 Sahyatri (सहयात्री)

**Smart Pilgrim Safety, Crowd Control & Indoor Navigation**

Sahyatri ("co-traveler") helps manage large crowds at pilgrimages, railway stations, and festivals. It uses AI cameras to detect danger, alerts security in real-time, and guides pilgrims indoors via a mobile app.

---

## 🔗 Live Links

| | Link |
|--|------|
| 📱 **Download Mobile App (APK)** | [Download for Android](https://expo.dev/artifacts/eas/4x6Rq4pasPeoKjcNpVXTYH.apk) |
| 🖥️ **Admin Dashboard (Web)** | [Open Dashboard](https://abc-three-phi.vercel.app/admin/notifications) |

---

## What It Does

- 📷 **Watches crowds** using AI (YOLOv8) to detect stampede risk
- 🚨 **Alerts security** instantly via email and the [admin dashboard](https://abc-three-phi.vercel.app/admin/notifications)
- 🗺️ **Navigates indoors** with accessible routes (ramps, elevators)
- 📊 **Shows live data** on the [admin dashboard](https://abc-three-phi.vercel.app/admin/notifications) with maps and charts
- 📱 **Guides pilgrims** via the [mobile app](https://expo.dev/artifacts/eas/4x6Rq4pasPeoKjcNpVXTYH.apk) with SOS button

---

## 5 Main Parts

| Service | What it does | Tech |
|---------|-------------|------|
| **ML Server** | Detects crowd density & risk | Python, Flask, YOLOv8 |
| **Realtime Server** | Sends alerts, tracks locations | Node.js, Socket.io, MongoDB |
| **Navigation Server** | Finds best indoor path | Node.js, A* algorithm |
| **Admin Dashboard** | Live map, charts, camera feed → [Open](https://abc-three-phi.vercel.app/admin/notifications) | React 19, Mapbox |
| **Mobile App** | Pilgrim navigation + SOS → [Download APK](https://expo.dev/artifacts/eas/4x6Rq4pasPeoKjcNpVXTYH.apk) | React Native, Expo |

---

## Folder Structure

```
Sahyatri/
├── backend/
│   ├── analytics-server/     # stats & history
│   └── realtime-server/      # alerts & live tracking
├── frontend/                 # admin web dashboard
├── indoor navigation/        # pathfinding engine
├── mobile/                   # pilgrim mobile app
├── stampede/                 # AI crowd detection
├── college.geojson           # campus map
└── JammuStation.geojson      # railway station map
```

---

## Setup

### Requirements
- Node.js v18+
- Python 3.9+
- MongoDB
- Mapbox token

---

### 1. Start the AI Server

```bash
cd stampede/Unified_Crowd_Risk_System
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Create a `.env` file:
```env
FLASK_PORT=5002
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
ADMIN_ALERT_EMAIL=security@yourdomain.com
```

---

### 2. Start Backend Servers

```bash
# Realtime server
cd backend/realtime-server
npm install && npm start

# Analytics server
cd backend/analytics-server
npm install && npm start

# Navigation server
cd "indoor navigation/backend"
npm install && npm start
```

---

### 3. Start Admin Dashboard

```bash
cd frontend
npm install
npm run dev
```

`.env` file:
```env
VITE_MAPBOX_ACCESS_TOKEN=your_token
VITE_API_URL=http://localhost:5000
```

> 🌐 Hosted version: [https://abc-three-phi.vercel.app/admin/notifications](https://abc-three-phi.vercel.app/admin/notifications)

---

### 4. Start Mobile App

```bash
cd mobile
npm install
npx expo start
```

`.env` file:
```env
EXPO_PUBLIC_API_URL=http://your-ip:5000
EXPO_PUBLIC_NAV_URL=http://your-ip:3000
```

> 📱 Pre-built APK: [Download here](https://expo.dev/artifacts/eas/4x6Rq4pasPeoKjcNpVXTYH.apk) — install directly on any Android device, no Play Store needed.

---

## API Endpoints

| URL | Description |
|-----|-------------|
| `http://localhost:5000` | Realtime WebSocket |
| `GET /api/telemetry` | Crowd data |
| `GET /api/route?from=...&to=...&accessible=true` | Indoor navigation |
| `http://localhost:5002/video_feed` | Live camera (admin only) |

---

## Security

- All server-to-server calls use **JWT tokens**
- Camera feed restricted to **admins only**

---

> Built to keep every pilgrim safe. 🕊️
