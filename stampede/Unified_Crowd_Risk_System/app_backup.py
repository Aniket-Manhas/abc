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

import config
from modules.detection    import PersonDetector
from modules.density      import DensityEstimator
from modules.optical_flow import OpticalFlowAnalyzer
from modules.risk_assessment import RiskAssessor
from modules.tracker      import TrackerWrapper
from utils.visualizer     import Visualizer

app = Flask(__name__)

# --- Global State ---
CAMERAS_FILE = "cameras.json"
current_camera_index = 0
global_metrics = {
    "location": "Loading...",
    "person_count": 0,
    "risk_level": "NORMAL",
    "alert_msg": "System initializing..."
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

# --- Video Processing Pipeline ---
class VideoCamera(object):
    def __init__(self, source):
        self.video = cv2.VideoCapture(source)
        # Give IP cams time to start
        deadline = time.time() + 5.0
        while time.time() < deadline:
            ret, _ = self.video.read()
            if ret:
                break
            time.sleep(0.2)

        self.detector = PersonDetector()
        self.estimator = DensityEstimator()
        self.flow_analyzer = OpticalFlowAnalyzer()
        self.assessor = RiskAssessor()
        self.visualizer = Visualizer()
        self.tracker = TrackerWrapper()

        self.frame_count = 0
        self.detect_every = 2
        self.last_boxes = []
        self.last_risk_map = None
        self.last_tracked = {}

    def __del__(self):
        self.video.release()

    def get_frame(self):
        global global_metrics
        success, frame = self.video.read()
        if not success or frame is None:
            return None

        self.frame_count += 1

        if self.frame_count % self.detect_every == 0:
            self.last_boxes = self.detector.detect(frame)
            self.last_tracked = self.tracker.track(self.last_boxes)

        boxes = self.last_boxes
        tracked_objects = self.last_tracked

        density_map, person_count = self.estimator.compute(frame, boxes)
        norm_density = self.estimator.normalize(density_map)

        flow_grid = self.flow_analyzer.analyze(frame)

        if flow_grid:
            risk_map, global_risk, alert_msg = self.assessor.assess(norm_density, flow_grid)
            self.last_risk_map = risk_map
        else:
            risk_map = self.last_risk_map or []
            global_risk = "NORMAL"
            alert_msg = ""

        # Update metrics for the web UI polling
        global_metrics["person_count"] = person_count
        if global_risk:
            global_metrics["risk_level"] = global_risk
        if alert_msg:
            global_metrics["alert_msg"] = alert_msg

        output = self.visualizer.render(frame, boxes, tracked_objects, risk_map, flow_grid)

        # Encode to JPEG
        ret, jpeg = cv2.imencode('.jpg', output)
        return jpeg.tobytes()

# --- Stream generator ---
def gen(camera):
    while True:
        frame = camera.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
        else:
            time.sleep(0.1)

# --- Routes ---
camera_instance = None

@app.route('/')
def index():
    cameras = load_cameras()
    return render_template('index.html', cameras=cameras, current_cam_id=current_camera_index)

@app.route('/video_feed')
def video_feed():
    global camera_instance
    cameras = load_cameras()
    cam = cameras[current_camera_index] if current_camera_index < len(cameras) else cameras[0]
    global_metrics["location"] = cam["location"]
    
    if camera_instance is None:
        camera_instance = VideoCamera(cam["source"])
        
    return Response(gen(camera_instance),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/metrics')
def metrics():
    return jsonify(global_metrics)

@app.route('/settings', methods=['POST'])
def update_settings():
    """Allows UI to add or update IP webcam sources"""
    global current_camera_index, camera_instance
    data = request.json
    
    source = data.get("source")
    location = data.get("location")
    
    try:
        # Convert to int if it's a simple camera index '0', '1', etc.
        source = int(source)
    except ValueError:
        pass # it's an IP URL

    cameras = load_cameras()
    new_id = len(cameras)
    cameras.append({"id": new_id, "source": source, "location": location})
    save_cameras(cameras)
    
    # Switch to new camera
    current_camera_index = new_id
    if camera_instance is not None:
        camera_instance.__del__()
        camera_instance = None
        
    return jsonify({"success": True, "id": new_id})

@app.route('/switch/<int:cam_id>', methods=['POST'])
def switch_camera(cam_id):
    global current_camera_index, camera_instance
    cameras = load_cameras()
    if 0 <= cam_id < len(cameras):
        current_camera_index = cam_id
        if camera_instance is not None:
            camera_instance.__del__()
            camera_instance = None
        return jsonify({"success": True})
    return jsonify({"success": False})

if __name__ == '__main__':
    # Make templates dir if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
