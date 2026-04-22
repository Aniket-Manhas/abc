# =============================================================================
# app.py — Flask Web Dashboard for Crowd Risk Detection
# Streams the processed video and sends live metrics to the web UI.
# =============================================================================

from flask import Flask, render_template, Response, jsonify, request
import cv2
import threading
import time
import json
import os
import mimetypes
from werkzeug.utils import secure_filename

# CORS support (install: pip install flask-cors)
try:
    from flask_cors import CORS
    _CORS_AVAILABLE = True
except ImportError:
    _CORS_AVAILABLE = False

import config
from modules.detection    import PersonDetector
from modules.density      import DensityEstimator
from modules.optical_flow import OpticalFlowAnalyzer
from modules.risk_assessment import RiskAssessor
from modules.tracker      import TrackerWrapper
from utils.visualizer     import Visualizer

app = Flask(__name__)

# Enable CORS so the React admin dashboard can call this API
if _CORS_AVAILABLE:
    CORS(app, resources={r"/*": {"origins": "*"}})
else:
    @app.after_request
    def _cors(response):
        response.headers['Access-Control-Allow-Origin']  = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        return response

# Upload folder for /upload_media
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Global State ---
CAMERAS_FILE = "cameras.json"
current_camera_index = 0
global_metrics = {
    "location":     "Loading...",
    "person_count": 0,
    "risk_level":   "NORMAL",
    "alert_msg":    "System initializing..."
}

def load_cameras():
    try:
        with open(CAMERAS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return [{"id": 0, "source": 0, "location": "Default Camera"}]

def save_cameras(cameras):
    with open(CAMERAS_FILE, "w") as f:
        json.dump(cameras, f, indent=4)


# =============================================================================
# VideoCamera — threaded capture + processing pipeline
# =============================================================================
class VideoCamera(object):
    def __init__(self, source):
        # ── Backend selection ─────────────────────────────────────────────────
        # IP camera URLs (MJPEG) → CAP_FFMPEG (MSMF cannot decode MJPEG-over-HTTP)
        # Integer webcam indices → CAP_DSHOW  (avoids MSMF grab-frame spam)
        if isinstance(source, str):
            self.video = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        else:
            self.video = cv2.VideoCapture(source, cv2.CAP_DSHOW)

        # Keep the internal buffer tiny so we always get the LATEST frame
        self.video.set(cv2.CAP_PROP_BUFFERSIZE, config.CAPTURE_BUFFER)

        # Wait until the source delivers a frame (up to 10 s for IP cams)
        deadline = time.time() + 10.0
        while time.time() < deadline:
            ret, _ = self.video.read()
            if ret:
                break
            time.sleep(0.2)

        # ── Processing modules ────────────────────────────────────────────────
        self.detector     = PersonDetector()
        self.estimator    = DensityEstimator()
        self.flow_analyzer = OpticalFlowAnalyzer()
        self.assessor     = RiskAssessor()
        self.visualizer   = Visualizer()
        self.tracker      = TrackerWrapper()

        self.frame_count  = 0
        self.detect_every = 3      # Run YOLO every N frames
        self.last_boxes   = []
        self.last_risk_map = None
        self.last_tracked  = {}

        self.latest_frame = None   # JPEG bytes — served to browser
        self.stopped      = False

        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def stop(self):
        """Cleanly signal the thread to stop, then release the capture."""
        self.stopped = True
        self.thread.join(timeout=3.0)
        self.video.release()

    def __del__(self):
        self.stopped = True
        try:
            self.video.release()
        except Exception:
            pass

    # ── Background thread ─────────────────────────────────────────────────────

    def update(self):
        global global_metrics
        while not self.stopped:
            # ── Drain stale buffered frames ───────────────────────────────────
            # grab() advances the capture position without decoding.
            # This discards any frames that piled up while we were processing,
            # ensuring retrieve() gives us the LATEST frame.
            for _ in range(config.DRAIN_FRAMES):
                if not self.video.grab():
                    break
            success, frame = self.video.retrieve()

            if not success or frame is None:
                time.sleep(0.01)
                continue

            # ── Resize for processing (reduces YOLO + optical-flow cost) ──────
            orig_h, orig_w = frame.shape[:2]
            if orig_w > config.PROCESS_WIDTH:
                scale = config.PROCESS_WIDTH / orig_w
                proc_w = config.PROCESS_WIDTH
                proc_h = int(orig_h * scale)
                proc_frame = cv2.resize(frame, (proc_w, proc_h))
            else:
                scale = 1.0
                proc_frame = frame

            self.frame_count += 1

            # ── YOLO detection (every N frames) ──────────────────────────────
            if self.frame_count % self.detect_every == 0:
                raw_boxes = self.detector.detect(proc_frame)
                # Scale boxes back to original frame dimensions
                if scale != 1.0:
                    self.last_boxes = [
                        (int(x1/scale), int(y1/scale),
                         int(x2/scale), int(y2/scale), conf)
                        for x1, y1, x2, y2, conf in raw_boxes
                    ]
                else:
                    self.last_boxes = raw_boxes
                self.last_tracked = self.tracker.track(self.last_boxes)

            boxes           = self.last_boxes
            tracked_objects = self.last_tracked
            person_count    = len(boxes)

            # ── Density map ───────────────────────────────────────────────────
            density_map, _ = self.estimator.compute(frame, boxes)
            norm_density   = self.estimator.normalize(density_map)

            # ── Optical flow (on proc_frame for speed) ────────────────────────
            flow_grid = self.flow_analyzer.analyze(proc_frame)

            # ── Risk assessment ───────────────────────────────────────────────
            if flow_grid:
                risk_map, global_risk, alert_msg = self.assessor.assess(
                    norm_density, flow_grid, person_count
                )
                self.last_risk_map = risk_map
            else:
                risk_map    = self.last_risk_map or []
                global_risk = "NORMAL"
                alert_msg   = ""

            # ── Update metrics for UI polling ─────────────────────────────────
            global_metrics["person_count"] = person_count
            if global_risk:
                global_metrics["risk_level"] = global_risk
            if alert_msg:
                global_metrics["alert_msg"] = alert_msg

            # ── Render + encode ───────────────────────────────────────────────
            output = self.visualizer.render(
                frame, boxes, tracked_objects, risk_map, flow_grid
            )
            ret, jpeg = cv2.imencode(
                '.jpg', output,
                [cv2.IMWRITE_JPEG_QUALITY, 80]   # Slightly compress for speed
            )
            if ret:
                self.latest_frame = jpeg.tobytes()

    def get_frame(self):
        return self.latest_frame


# =============================================================================
# MJPEG stream generator
# =============================================================================
def gen(camera):
    while True:
        frame = camera.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
            time.sleep(0.033)   # ~30 fps ceiling
        else:
            time.sleep(0.05)


# =============================================================================
# Routes
# =============================================================================
camera_instance = None

@app.route('/')
def index():
    cameras = load_cameras()
    return render_template('index.html', cameras=cameras, current_cam_id=current_camera_index)

@app.route('/video_feed')
def video_feed():
    """MJPEG stream. Accepts optional ?camera=<int> to switch source."""
    global camera_instance, current_camera_index
    cameras = load_cameras()

    # Support ?camera=N query parameter (used by StampedeMonitor.jsx)
    cam_param = request.args.get('camera', None)
    if cam_param is not None:
        try:
            idx = int(cam_param)
            if 0 <= idx < len(cameras) and idx != current_camera_index:
                current_camera_index = idx
                if camera_instance is not None:
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


# ── NEW: /api/status  ─ health check used by StampedeMonitor.jsx ─────
@app.route('/api/status')
def api_status():
    return jsonify({"ok": True, "service": "unified_crowd_risk_system"})


# ── NEW: /stream_status  ─ SSE stream consumed by StampedeMonitor.jsx ────
@app.route('/stream_status')
def stream_status():
    """Server-Sent Events: emits global_metrics as JSON every second."""
    def event_gen():
        while True:
            data = {
                "status":             global_metrics.get("risk_level", "Normal"),
                "persons":            global_metrics.get("person_count", 0),
                "high_risk_cells":    0,   # UCRS uses a different risk model
                "critical_risk_cells":0,
                "density_grid":       None,
                "risk_score_grid":    None,
                "location":           global_metrics.get("location", ""),
                "alert_msg":          global_metrics.get("alert_msg", ""),
            }
            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(1.0)
    return Response(event_gen(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


# ── NEW: /upload_media  ─ single image/video analysis ────────────────
@app.route('/upload_media', methods=['POST'])
def upload_media():
    """Accepts an image or short video, runs YOLO on it, returns JSON result."""
    if 'media' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['media']
    if not f.filename:
        return jsonify({'error': 'No filename'}), 400

    fname = secure_filename(f.filename)
    unique = f"{int(time.time())}_{fname}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
    f.save(save_path)

    mime = mimetypes.guess_type(save_path)[0] or ''
    result = {'prediction_status': 'Normal', 'max_persons': 0, 'processing_time': '0'}
    t0 = time.time()

    try:
        # Peek at first frame (works for both image and video)
        cap = cv2.VideoCapture(save_path)
        ret, frame = cap.read()
        cap.release()

        if ret and frame is not None:
            # Use the VideoCamera pipeline's detector if we have an instance,
            # otherwise do a lightweight detection with a fresh camera
            from modules.detection import PersonDetector
            from modules.density   import DensityEstimator
            from modules.risk_assessment import RiskAssessor

            detector  = PersonDetector()
            estimator = DensityEstimator()
            assessor  = RiskAssessor()

            boxes = detector.detect(frame)
            density_map, _ = estimator.compute(frame, boxes)
            norm = estimator.normalize(density_map)
            _, global_risk, alert = assessor.assess(norm, [], len(boxes))

            result['prediction_status'] = global_risk or 'Normal'
            result['max_persons']       = len(boxes)
    except Exception as e:
        result['prediction_status'] = f'Error ({type(e).__name__})'
    finally:
        result['processing_time'] = f'{time.time() - t0:.2f}'
        try:
            os.remove(save_path)
        except OSError:
            pass

    return jsonify(result)

@app.route('/settings', methods=['POST'])
def update_settings():
    """Allows UI to add or update IP webcam sources."""
    global current_camera_index, camera_instance
    data = request.json

    source   = data.get("source")
    location = data.get("location")

    try:
        source = int(source)
    except (ValueError, TypeError):
        pass   # it's an IP URL string

    cameras = load_cameras()
    new_id  = len(cameras)
    cameras.append({"id": new_id, "source": source, "location": location})
    save_cameras(cameras)

    current_camera_index = new_id
    if camera_instance is not None:
        camera_instance.stop()
        camera_instance = None

    return jsonify({"success": True, "id": new_id})

@app.route('/switch/<int:cam_id>', methods=['POST'])
def switch_camera(cam_id):
    global current_camera_index, camera_instance
    cameras = load_cameras()
    if 0 <= cam_id < len(cameras):
        current_camera_index = cam_id
        if camera_instance is not None:
            camera_instance.stop()
            camera_instance = None
        return jsonify({"success": True})
    return jsonify({"success": False})

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    os.makedirs('uploads', exist_ok=True)
    # Port 5002 — matches VITE_STAMPEDE_URL in frontend/.env
    app.run(host='0.0.0.0', port=5002, debug=True, threaded=True)
