# =============================================================================
# app.py — AI Crowd Density Monitoring System  (Flask backend, port 5002)
#
# Hybrid pipeline:
#   Sparse crowds  (<DENSE_THRESHOLD)  → YOLOv8  person detection
#   Dense crowds   (≥DENSE_THRESHOLD)  → P2PNet  point-based crowd counting
#
# API endpoints (fully compatible with StampedeMonitor.jsx):
#   GET  /video_feed?camera=N  — MJPEG stream with overlays
#   GET  /stream_status        — SSE stream with live metrics
#   GET  /metrics              — JSON snapshot of current metrics
#   GET  /api/status           — Health check
#   POST /upload_media         — Analyse an uploaded image/video file
#   POST /settings             — Add a new IP camera
#   POST /switch/<cam_id>      — Switch active camera
# =============================================================================

from flask import Flask, render_template, Response, jsonify, request
import cv2
import threading
import time
import json
import os
import mimetypes
from werkzeug.utils import secure_filename
import requests

try:
    from flask_cors import CORS
    _CORS_AVAILABLE = True
except ImportError:
    _CORS_AVAILABLE = False

import config
from modules.detection       import PersonDetector
from modules.p2pnet_counter  import P2PNetCounter
from modules.density         import DensityEstimator
from modules.optical_flow    import OpticalFlowAnalyzer
from modules.risk_assessment import RiskAssessor
from modules.tracker         import TrackerWrapper
from utils.visualizer        import Visualizer
from utils.mailer            import send_alert

# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

if _CORS_AVAILABLE:
    CORS(app, resources={r"/*": {"origins": "*"}})
else:
    @app.after_request
    def _cors(response):
        response.headers['Access-Control-Allow-Origin']  = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        return response

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

CAMERAS_FILE = "cameras.json"
current_camera_index = 0

global_metrics = {
    "location":               "Loading…",
    "person_count":           0,
    "peak_count":             0,   # max persons seen in any single frame
    "total_persons_detected": 0,   # running cumulative sum (approx unique)
    "risk_level":             "SAFE",
    "alert_msg":              "System initializing…",
    "density_m2":             0.0,
    "risk_score":             0.0,
    "using_p2pnet":           False,
    "zone_data":              [],
    "density_grid":           None,   # 2-D list (GRID_ROWS × GRID_COLS) of p/m²
    "risk_score_grid":        None,   # 2-D list (GRID_ROWS × GRID_COLS) of 0–1
}


def load_cameras():
    try:
        with open(CAMERAS_FILE) as f:
            return json.load(f)
    except Exception:
        return [{"id": 0, "source": 0, "location": "Default Camera"}]


def save_cameras(cameras):
    with open(CAMERAS_FILE, "w") as f:
        json.dump(cameras, f, indent=4)


# =============================================================================
# VideoCamera — threaded capture + hybrid processing pipeline
# =============================================================================
class VideoCamera:
    def __init__(self, source):
        if isinstance(source, str):
            self.video = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        else:
            self.video = cv2.VideoCapture(source, cv2.CAP_DSHOW)

        self.video.set(cv2.CAP_PROP_BUFFERSIZE, config.CAPTURE_BUFFER)

        # Wait for first frame (IP cams can be slow)
        deadline = time.time() + 10.0
        while time.time() < deadline:
            ret, _ = self.video.read()
            if ret:
                break
            time.sleep(0.2)

        # ── Processing modules ────────────────────────────────────────────────
        self.detector     = PersonDetector()
        self.p2pnet       = P2PNetCounter()
        self.estimator    = DensityEstimator()
        self.flow_analyzer = OpticalFlowAnalyzer()
        self.assessor     = RiskAssessor()
        self.visualizer   = Visualizer()
        self.tracker      = TrackerWrapper()

        self.frame_count      = 0
        self.detect_every     = 3
        self.p2pnet_counter   = 0   # counts frames since last P2PNet run

        # Cache from last detection / counting cycle
        self.last_boxes       = []
        self.last_tracked     = {}
        self.last_p2pnet_pts  = []
        self.last_risk_map    = []
        self.last_count       = 0
        self.using_p2pnet     = False

        self.latest_frame = None
        self.stopped      = False
        self._frame_lock  = threading.Lock()   # protects raw_frame
        self.raw_frame    = None
        
        self.last_alert_time  = 0
        self.alert_cooldown   = 60  # seconds between identical alerts
        self.last_analytics_time = 0
        self.analytics_interval = 10 # seconds between analytics logs

        # Two threads: reader keeps buffer fresh, update does processing
        self._reader_thread = threading.Thread(target=self._reader, daemon=True)
        self._reader_thread.start()
        self._proc_thread   = threading.Thread(target=self._update, daemon=True)
        self._proc_thread.start()

    # ── Frame reader ──────────────────────────────────────────────────────────

    def _reader(self):
        while not self.stopped:
            ret, frame = self.video.read()
            if ret:
                with self._frame_lock:
                    self.raw_frame = frame
            else:
                time.sleep(0.01)

    # ── Processing loop ───────────────────────────────────────────────────────

    def _update(self):
        global global_metrics
        while not self.stopped:
            with self._frame_lock:
                frame = self.raw_frame
            if frame is None:
                time.sleep(0.01)
                continue

            # ── Resize for processing ─────────────────────────────────────────
            orig_h, orig_w = frame.shape[:2]
            if orig_w > config.PROCESS_WIDTH:
                scale     = config.PROCESS_WIDTH / orig_w
                proc_frame = cv2.resize(frame, (config.PROCESS_WIDTH,
                                                int(orig_h * scale)))
            else:
                scale      = 1.0
                proc_frame = frame

            self.frame_count    += 1
            self.p2pnet_counter += 1

            # ── YOLO detection (every N frames) ──────────────────────────────
            if self.frame_count % self.detect_every == 0:
                raw_boxes = self.detector.detect(proc_frame)
                if scale != 1.0:
                    self.last_boxes = [
                        (int(x1/scale), int(y1/scale),
                         int(x2/scale), int(y2/scale), conf)
                        for x1, y1, x2, y2, conf in raw_boxes
                    ]
                else:
                    self.last_boxes = raw_boxes
                self.last_tracked = self.tracker.track(self.last_boxes)

            yolo_count = len(self.last_boxes)

            # ── P2PNet (dense crowd, every P2PNET_INTERVAL frames) ────────────
            use_p2pnet = (
                self.p2pnet.available and
                config.P2PNET_ENABLED and
                (yolo_count >= config.DENSE_THRESHOLD or
                 self.p2pnet_counter >= config.P2PNET_INTERVAL)
            )

            if use_p2pnet:
                pts, p2p_count = self.p2pnet.count(proc_frame)
                # Scale points back to original frame
                if scale != 1.0:
                    pts = [(int(x/scale), int(y/scale)) for (x, y) in pts]
                self.last_p2pnet_pts = pts
                self.last_count      = p2p_count
                self.using_p2pnet    = True
                self.p2pnet_counter  = 0
            else:
                self.last_count   = yolo_count
                self.using_p2pnet = False

            # ── Density estimation ────────────────────────────────────────────
            if self.using_p2pnet and self.last_p2pnet_pts:
                (density_map, density_map_m2,
                 global_count, global_density_m2) = self.estimator.compute_from_points(
                    frame, self.last_p2pnet_pts)
            else:
                (density_map, density_map_m2,
                 global_count, global_density_m2) = self.estimator.compute_from_boxes(
                    frame, self.last_boxes)

            norm_density = self.estimator.normalize(density_map)

            # ── Optical flow ──────────────────────────────────────────────────
            flow_grid = self.flow_analyzer.analyze(proc_frame)

            # ── Risk assessment ───────────────────────────────────────────────
            risk_map, global_risk, alert_msg, risk_score = self.assessor.assess(
                density_map_m2, norm_density, flow_grid,
                global_count, global_density_m2
            )
            self.last_risk_map = risk_map

            zone_data = self.estimator.get_zone_data(density_map_m2, risk_map)

            # Build 2-D grids for the frontend
            d_grid = density_map_m2.tolist()
            r_grid = [[cell['score'] for cell in row] for row in risk_map]

            # ── Update shared metrics ─────────────────────────────────────────
            prev_peak  = global_metrics.get("peak_count", 0)
            prev_total = global_metrics.get("total_persons_detected", 0)
            new_peak   = max(prev_peak, global_count)
            # Accumulate new arrivals (persons above previous frame count)
            new_total  = prev_total + max(0, global_count - self.last_count)
            self.last_count = global_count

            # Email Alert Logic
            if global_risk == "DANGER" and (time.time() - self.last_alert_time) > self.alert_cooldown:
                self.last_alert_time = time.time()
                subject = f"🚨 URGENT: Stampede Risk [DANGER] at {global_metrics.get('location', 'Camera')}"
                body = f"High crowd density detected!\n\n" \
                       f"Location: {global_metrics.get('location', 'Unknown')}\n" \
                       f"Persons: {global_count}\n" \
                       f"Density: {global_density_m2:.2f} p/m2\n" \
                       f"Action Required: Immediate crowd control measures necessary."
                send_alert(subject, body)

            # Analytics Logging
            if (time.time() - self.last_analytics_time) > self.analytics_interval:
                self.last_analytics_time = time.time()
                try:
                    mapped_density = 'high' if global_risk in ['DANGER', 'HIGH RISK'] else 'medium' if global_risk == 'ELEVATED' else 'low'
                    payload = {
                        "nodeId": global_metrics.get("location", "unknown").replace(' ', '_').lower(),
                        "nodeName": global_metrics.get("location", "Unknown"),
                        "density": mapped_density,
                        "personCount": global_count,
                        "source": "camera",
                        "floor": 0
                    }
                    requests.post("http://127.0.0.1:5001/api/analytics/crowd", json=payload, timeout=2)
                except Exception as e:
                    pass

            global_metrics.update({
                "person_count":           global_count,
                "peak_count":             new_peak,
                "total_persons_detected": new_total,
                "risk_level":             global_risk,
                "alert_msg":              alert_msg,
                "density_m2":             round(global_density_m2, 3),
                "risk_score":             risk_score,
                "using_p2pnet":           self.using_p2pnet,
                "zone_data":              zone_data,
                "density_grid":           d_grid,
                "risk_score_grid":        r_grid,
            })

            # ── Render annotated frame ────────────────────────────────────────
            output = self.visualizer.render(
                frame,
                self.last_boxes,
                self.last_tracked,
                risk_map,
                flow_grid,
                p2pnet_points=self.last_p2pnet_pts if self.using_p2pnet else None,
                using_p2pnet=self.using_p2pnet,
            )
            output = self.visualizer.draw_hud(
                output,
                person_count=global_count,
                risk_level=global_risk,
                using_p2pnet=self.using_p2pnet,
                density_m2=global_density_m2,
            )
            ret, jpeg = cv2.imencode('.jpg', output,
                                     [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                self.latest_frame = jpeg.tobytes()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def get_frame(self):
        return self.latest_frame

    def stop(self):
        self.stopped = True
        self._reader_thread.join(timeout=1.0)
        self._proc_thread.join(timeout=3.0)
        self.video.release()

    def __del__(self):
        self.stopped = True
        try:
            self.video.release()
        except Exception:
            pass


# =============================================================================
# MJPEG stream generator
# =============================================================================
def gen(camera):
    while True:
        frame = camera.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
            time.sleep(0.033)
        else:
            time.sleep(0.05)


# =============================================================================
# Routes
# =============================================================================
camera_instance = None


@app.route('/')
def index():
    cameras = load_cameras()
    return render_template('index.html',
                           cameras=cameras,
                           current_cam_id=current_camera_index)


@app.route('/video_feed')
def video_feed():
    global camera_instance, current_camera_index
    cameras = load_cameras()

    cam_param = request.args.get('camera')
    if cam_param is not None:
        try:
            idx = int(cam_param)
            if 0 <= idx < len(cameras) and idx != current_camera_index:
                current_camera_index = idx
                if camera_instance:
                    camera_instance.stop()
                    camera_instance = None
        except ValueError:
            pass

    cam = cameras[current_camera_index] if current_camera_index < len(cameras) else cameras[0]
    global_metrics["location"] = cam["location"]

    if camera_instance is None:
        camera_instance = VideoCamera(cam["source"])

    return Response(gen(camera_instance),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/metrics')
def metrics():
    return jsonify(global_metrics)


@app.route('/api/status')
def api_status():
    return jsonify({
        "ok":          True,
        "service":     "ai_crowd_density_monitor",
        "p2pnet":      camera_instance.p2pnet.available if camera_instance else False,
    })


@app.route('/stream_status')
def stream_status():
    """Server-Sent Events — emits full metrics JSON every second."""
    def event_gen():
        while True:
            data = {
                "status":             global_metrics.get("risk_level",     "SAFE"),
                "persons":            global_metrics.get("person_count",   0),
                "density_m2":         global_metrics.get("density_m2",     0.0),
                "risk_score":         global_metrics.get("risk_score",     0.0),
                "using_p2pnet":       global_metrics.get("using_p2pnet",  False),
                "location":           global_metrics.get("location",       ""),
                "alert_msg":          global_metrics.get("alert_msg",      ""),
                "zone_data":          global_metrics.get("zone_data",      []),
                "density_grid":       global_metrics.get("density_grid",   None),
                "risk_score_grid":    global_metrics.get("risk_score_grid",None),
                # Legacy keys — kept for backward compat with old frontend code
                "high_risk_cells":    sum(
                    1 for z in global_metrics.get("zone_data", [])
                    if z.get("risk_level") in ("HIGH RISK",)
                ),
                "critical_risk_cells": sum(
                    1 for z in global_metrics.get("zone_data", [])
                    if z.get("risk_level") == "DANGER"
                ),
            }
            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(1.0)

    return Response(event_gen(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache',
                             'X-Accel-Buffering': 'no'})


@app.route('/upload_media', methods=['POST'])
def upload_media():
    """Accepts an image or video, runs YOLO + P2PNet over all frames, returns JSON result."""
    if 'media' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['media']
    if not f.filename:
        return jsonify({'error': 'No filename'}), 400

    fname     = secure_filename(f.filename)
    unique    = f"{int(time.time())}_{fname}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
    f.save(save_path)

    result = {
        'prediction_status':      'SAFE',
        'max_persons':            0,
        'total_persons_detected': 0,
        'density_m2':             0.0,
        'using_p2pnet':           False,
        'frames_analysed':        0,
        'processing_time':        '0',
    }
    t0 = time.time()

    try:
        import numpy as np
        cap = cv2.VideoCapture(save_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        # Sample every 0.5 s (2 frames/sec) for better accuracy vs speed balance
        sample_every = max(1, int(fps * 0.5))

        detector  = PersonDetector()
        p2pnet    = P2PNetCounter()
        estimator = DensityEstimator()
        assessor  = RiskAssessor()

        frame_idx         = 0
        frames_analysed   = 0
        max_persons       = 0
        total_detected    = 0
        worst_risk        = 'SAFE'
        worst_density     = 0.0
        using_p2pnet_ever = False
        prev_count        = 0

        RISK_ORDER = ['SAFE', 'WARNING', 'HIGH RISK', 'DANGER']

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            # Only analyse one frame per second
            if frame_idx % sample_every != 0:
                continue

            frames_analysed += 1
            boxes      = detector.detect(frame)
            yolo_count = len(boxes)

            using_p2pnet = p2pnet.available and yolo_count >= config.DENSE_THRESHOLD
            if using_p2pnet:
                pts, count = p2pnet.count(frame)
                (_, d_m2, _, g_density) = estimator.compute_from_points(frame, pts)
                using_p2pnet_ever = True
            else:
                pts       = []
                count     = yolo_count
                (_, d_m2, _, g_density) = estimator.compute_from_boxes(frame, boxes)

            norm = estimator.normalize(np.zeros((config.GRID_ROWS, config.GRID_COLS)))
            risk_map, global_risk, _, _ = assessor.assess(d_m2, norm, [], count, g_density)

            max_persons    = max(max_persons, count)
            # Count new arrivals vs previous sample
            total_detected += max(0, count - prev_count)
            prev_count      = count

            if RISK_ORDER.index(global_risk) > RISK_ORDER.index(worst_risk):
                worst_risk    = global_risk
                worst_density = round(g_density, 3)

        cap.release()

        result['prediction_status']      = worst_risk
        result['max_persons']            = max_persons
        result['total_persons_detected'] = total_detected
        result['density_m2']             = worst_density
        result['using_p2pnet']           = using_p2pnet_ever
        result['frames_analysed']        = frames_analysed

    except Exception as exc:
        result['prediction_status'] = f'Error ({type(exc).__name__}: {exc})'
    finally:
        result['processing_time'] = f'{time.time() - t0:.2f}'
        try:
            os.remove(save_path)
        except OSError:
            pass

    return jsonify(result)


@app.route('/settings', methods=['POST'])
def update_settings():
    global current_camera_index, camera_instance
    data     = request.json
    source   = data.get("source")
    location = data.get("location")

    try:
        source = int(source)
    except (ValueError, TypeError):
        pass

    cameras = load_cameras()
    new_id  = len(cameras)
    cameras.append({"id": new_id, "source": source, "location": location})
    save_cameras(cameras)

    current_camera_index = new_id
    if camera_instance:
        camera_instance.stop()
        camera_instance = None

    return jsonify({"success": True, "id": new_id})


@app.route('/switch/<int:cam_id>', methods=['POST'])
def switch_camera(cam_id):
    global current_camera_index, camera_instance
    cameras = load_cameras()
    if 0 <= cam_id < len(cameras):
        current_camera_index = cam_id
        if camera_instance:
            camera_instance.stop()
            camera_instance = None
        return jsonify({"success": True})
    return jsonify({"success": False})


# =============================================================================
# VideoFileCamera — full pipeline on an uploaded video file (for testing)
# =============================================================================
class VideoFileCamera:
    """
    Reads a saved video file frame-by-frame through the full
    YOLO + P2PNet hybrid pipeline and exposes MJPEG + metrics,
    just like VideoCamera does for live streams.
    Loops the video when it reaches the end.
    """

    def __init__(self, path):
        self.path  = path
        self.video = cv2.VideoCapture(path)
        if not self.video.isOpened():
            raise ValueError(f"Cannot open video: {path}")

        self.fps   = self.video.get(cv2.CAP_PROP_FPS) or 25.0
        self.delay = max(1.0 / self.fps, 0.02)

        # ── Shared pipeline modules ──────────────────────────────────────────
        self.detector      = PersonDetector()
        self.p2pnet        = P2PNetCounter()
        self.estimator     = DensityEstimator()
        self.flow_analyzer = OpticalFlowAnalyzer()
        self.assessor      = RiskAssessor()
        self.visualizer    = Visualizer()
        self.tracker       = TrackerWrapper()

        self.frame_count     = 0
        self.p2pnet_counter  = 0
        self.last_boxes      = []
        self.last_tracked    = {}
        self.last_p2pnet_pts = []
        self.last_risk_map   = []
        self.using_p2pnet    = False

        self.latest_frame   = None
        self._frame_ready   = threading.Event()   # signals new frame is available
        self.peak_count     = 0   # max persons in any single frame
        self.total_detected = 0   # cumulative sum of new arrivals
        self.prev_count     = 0   # count from previous frame for delta
        self.file_metrics   = {
            "person_count":           0,
            "peak_count":             0,
            "total_persons_detected": 0,
            "risk_level":             "SAFE",
            "density_m2":             0.0,
            "risk_score":             0.0,
            "using_p2pnet":           False,
            "alert_msg":              "Initialising…",
            "frame_no":               0,
            "total_frames":           int(self.video.get(cv2.CAP_PROP_FRAME_COUNT)),
        }
        self.stopped = False

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        while not self.stopped:
            ret, frame = self.video.read()
            if not ret:
                # Loop back to start
                self.video.set(cv2.CAP_PROP_POS_FRAMES, 0)
                self.flow_analyzer = OpticalFlowAnalyzer()  # reset flow state
                continue

            self.frame_count    += 1
            self.p2pnet_counter += 1

            # Resize for processing
            orig_h, orig_w = frame.shape[:2]
            if orig_w > config.PROCESS_WIDTH:
                scale      = config.PROCESS_WIDTH / orig_w
                proc_frame = cv2.resize(frame, (config.PROCESS_WIDTH, int(orig_h * scale)))
            else:
                scale      = 1.0
                proc_frame = frame

            # YOLO every 3 frames
            if self.frame_count % 3 == 0:
                raw = self.detector.detect(proc_frame)
                if scale != 1.0:
                    self.last_boxes = [
                        (int(x1/scale), int(y1/scale), int(x2/scale), int(y2/scale), c)
                        for x1, y1, x2, y2, c in raw
                    ]
                else:
                    self.last_boxes = raw
                self.last_tracked = self.tracker.track(self.last_boxes)

            yolo_count = len(self.last_boxes)

            # P2PNet when dense
            if (self.p2pnet.available and config.P2PNET_ENABLED and
                    (yolo_count >= config.DENSE_THRESHOLD or
                     self.p2pnet_counter >= config.P2PNET_INTERVAL)):
                pts, p2p_count = self.p2pnet.count(proc_frame)
                if scale != 1.0:
                    pts = [(int(x/scale), int(y/scale)) for x, y in pts]
                self.last_p2pnet_pts = pts
                self.using_p2pnet    = True
                self.p2pnet_counter  = 0
            else:
                self.using_p2pnet = False

            # Density
            if self.using_p2pnet and self.last_p2pnet_pts:
                dm, dm2, gc, gd = self.estimator.compute_from_points(frame, self.last_p2pnet_pts)
            else:
                dm, dm2, gc, gd = self.estimator.compute_from_boxes(frame, self.last_boxes)

            norm      = self.estimator.normalize(dm)
            flow_grid = self.flow_analyzer.analyze(proc_frame)
            risk_map, g_risk, alert, r_score = self.assessor.assess(
                dm2, norm, flow_grid, gc, gd)
            self.last_risk_map = risk_map

            # Track peak and cumulative counts
            self.peak_count     = max(self.peak_count, gc)
            self.total_detected += max(0, gc - self.prev_count)
            self.prev_count      = gc

            self.file_metrics.update({
                "person_count":           gc,
                "peak_count":             self.peak_count,
                "total_persons_detected": self.total_detected,
                "risk_level":             g_risk,
                "density_m2":             round(gd, 3),
                "risk_score":             r_score,
                "using_p2pnet":           self.using_p2pnet,
                "alert_msg":              alert,
                "frame_no":               int(self.video.get(cv2.CAP_PROP_POS_FRAMES)),
            })

            out = self.visualizer.render(
                frame, self.last_boxes, self.last_tracked, risk_map, flow_grid,
                p2pnet_points=self.last_p2pnet_pts if self.using_p2pnet else None,
                using_p2pnet=self.using_p2pnet,
            )
            out = self.visualizer.draw_hud(
                out,
                person_count=gc,
                risk_level=g_risk,
                using_p2pnet=self.using_p2pnet,
                density_m2=gd,
            )
            # Throttle to native video FPS to prevent jitter from frame-skipping
            frame_start = time.time()

            ret2, jpeg = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 82])
            if ret2:
                self.latest_frame = jpeg.tobytes()
                self._frame_ready.set()   # wake any waiting generator

            # Precise FPS throttle: sleep the remainder of the frame period
            elapsed = time.time() - frame_start
            sleep_t = max(0.0, self.delay - elapsed)
            time.sleep(sleep_t)

    def get_frame(self):
        return self.latest_frame

    def stop(self):
        self.stopped = True
        self._thread.join(timeout=3.0)
        self.video.release()

    def __del__(self):
        self.stopped = True
        try:
            self.video.release()
        except Exception:
            pass


# ── Global file-video state ───────────────────────────────────────────────────
file_camera_instance  = None
file_camera_lock      = threading.Lock()


def gen_file(fc):
    """MJPEG generator — yields only genuinely new frames via threading.Event."""
    last_frame = None
    while True:
        # Wait up to 0.2 s for a new frame; avoids serving stale duplicate
        fc._frame_ready.wait(timeout=0.2)
        fc._frame_ready.clear()
        frame = fc.get_frame()
        if frame and frame is not last_frame:
            last_frame = frame
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
        else:
            time.sleep(0.02)


@app.route('/load_video', methods=['POST'])
def load_video():
    """Upload a video file; start full-pipeline analysis. Returns {ok, filename}."""
    global file_camera_instance
    if 'video' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['video']
    if not f.filename:
        return jsonify({'error': 'Empty filename'}), 400

    fname     = secure_filename(f.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], f"vid_{int(time.time())}_{fname}")
    f.save(save_path)

    with file_camera_lock:
        if file_camera_instance:
            file_camera_instance.stop()
        try:
            file_camera_instance = VideoFileCamera(save_path)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    return jsonify({'ok': True, 'filename': fname})


@app.route('/file_feed')
def file_feed():
    """MJPEG stream for the currently loaded video file."""
    global file_camera_instance
    with file_camera_lock:
        fc = file_camera_instance
    if fc is None:
        return jsonify({'error': 'No video loaded'}), 404
    return Response(gen_file(fc),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/file_metrics')
def file_metrics_route():
    """JSON metrics for the currently loaded video file."""
    global file_camera_instance
    with file_camera_lock:
        fc = file_camera_instance
    if fc is None:
        return jsonify({'error': 'No video loaded'}), 404
    return jsonify(fc.file_metrics)


if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static',    exist_ok=True)
    os.makedirs('uploads',   exist_ok=True)
    # Port 5002 — matches VITE_STAMPEDE_URL in frontend/.env
    app.run(host='0.0.0.0', port=5002, debug=True, threaded=True)

