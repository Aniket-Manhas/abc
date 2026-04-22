# =============================================================================
# main.py — Real-Time Crowd Risk Detection System for Railway Stations
# Entry point: ties detection, density, optical flow, risk & visualiser together
#
# Usage:
#   python main.py                  # Use camera id=0 from cameras.json
#   python main.py --camera 1       # Use camera id=1 (IP Webcam)
#   python main.py --video path.mp4 # Use a video file instead
#   python main.py --list-cameras   # Show all configured cameras
# =============================================================================

import argparse
import json
import os
import sys
import time

import cv2

# ── Local imports ─────────────────────────────────────────────────────────────
import config
from modules.detection    import PersonDetector
from modules.density      import DensityEstimator
from modules.optical_flow import OpticalFlowAnalyzer
from modules.risk_assessment import RiskAssessor
from modules.tracker      import TrackerWrapper
from utils.visualizer     import Visualizer


# =============================================================================
# Camera helpers
# =============================================================================

def load_cameras(path="cameras.json"):
    """Load the camera registry from cameras.json."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[WARN] {path} not found — defaulting to webcam index 0.")
        return [{"id": 0, "source": 0, "location": "Default Camera"}]


def get_camera_entry(cameras, cam_id):
    for cam in cameras:
        if cam["id"] == cam_id:
            return cam
    print(f"[WARN] Camera id={cam_id} not found in cameras.json — using first entry.")
    return cameras[0]


def open_source(source):
    """
    Open a cv2.VideoCapture from either an integer index or a URL string.

    * URL strings (IP Webcam MJPEG)  → CAP_FFMPEG  (MSMF cannot decode MJPEG-over-HTTP)
    * Integer indices (local webcam) → CAP_DSHOW   (avoids MSMF grab-frame spam on Windows)
    """
    if isinstance(source, str):
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
    else:
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)

    # Keep internal buffer minimal so we always read the latest frame
    cap.set(cv2.CAP_PROP_BUFFERSIZE, config.CAPTURE_BUFFER)

    # Give IP cameras more time to connect and deliver the first frame
    deadline = time.time() + 10.0
    while time.time() < deadline:
        ret, _ = cap.read()
        if ret:
            return cap
        time.sleep(0.2)
    cap.release()
    return None


# =============================================================================
# Main pipeline
# =============================================================================

def run(source, location):
    """
    Core loop: read frames → detect → density → flow → risk → visualise.
    Press  Q  or  ESC  to quit.
    Press  S  to save a screenshot.
    """
    print(f"\n[System] Starting Crowd Risk Detection")
    print(f"[System] Location : {location}")
    print(f"[System] Source   : {source}")
    print(f"[System] Grid     : {config.GRID_ROWS} x {config.GRID_COLS}")
    print(f"[System] Press Q/ESC to quit, S to save screenshot\n")

    # ── Initialise modules ────────────────────────────────────────────────────
    detector  = PersonDetector()
    estimator = DensityEstimator()
    flow_analyzer = OpticalFlowAnalyzer()
    assessor  = RiskAssessor()
    visualizer = Visualizer()
    tracker = TrackerWrapper()

    # ── Open video source ─────────────────────────────────────────────────────
    cap = open_source(source)
    if cap is None:
        print(f"[ERROR] Cannot open source: {source}")
        print("  → If using webcam: make sure it is connected.")
        print("  → If using IP Webcam: ensure the phone and PC are on the same Wi-Fi,")
        print("    then update cameras.json with the correct URL (e.g. http://192.168.x.x:8080/video).")
        sys.exit(1)

    # ── FPS throttle for display ───────────────────────────────────────────────
    frame_count   = 0
    detect_every  = 2   # Run YOLO every N frames (keeps flow smooth, saves CPU)
    last_boxes    = []
    last_tracked  = {}
    last_risk_map = None
    last_global   = "NORMAL"
    last_alert    = "Situation normal. No immediate action required."

    print("[System] Live feed running...")

    while True:
        # Drain stale buffered frames so we always process the LATEST one
        for _ in range(config.DRAIN_FRAMES):
            if not cap.grab():
                break
        ret, frame = cap.retrieve()
        if not ret or frame is None:
            # Fall back to a normal read (handles edge cases)
            ret, frame = cap.read()
        if not ret or frame is None:
            print("[WARN] Frame read failed — retrying...")
            time.sleep(0.05)
            continue

        frame_count += 1

        # ── YOLO detection (every N frames) ───────────────────────────────────
        if frame_count % detect_every == 0:
            last_boxes = detector.detect(frame)
            last_tracked = tracker.track(last_boxes)

        boxes = last_boxes
        tracked_objects = last_tracked

        # ── Density map ───────────────────────────────────────────────────────
        density_map, person_count = estimator.compute(frame, boxes)
        norm_density              = estimator.normalize(density_map)

        # ── Optical flow (every frame for smooth arrows) ───────────────────────
        flow_grid = flow_analyzer.analyze(frame)

        # ── Risk assessment ────────────────────────────────────────────────────
        risk_map, global_risk, alert_msg = assessor.assess(
            norm_density, flow_grid, person_count
        )

        # Keep last valid risk (flow_grid is None on very first frame)
        if risk_map:
            last_risk_map = risk_map
            last_global   = global_risk
            last_alert    = alert_msg
        else:
            risk_map    = last_risk_map or []
            global_risk = last_global
            alert_msg   = last_alert

        # ── Visualise ──────────────────────────────────────────────────────────
        output = visualizer.render(
            frame,
            boxes,
            tracked_objects,
            risk_map,
            flow_grid
        )

        # ── Console log on state change ───────────────────────────────────────
        if frame_count % 30 == 0:
            ts = time.strftime("%H:%M:%S")
            print(f"[{ts}] Loc={location!r}  People={person_count}  Risk={global_risk}")

        # ── Show window ────────────────────────────────────────────────────────
        cv2.imshow("Crowd Risk Detection — Railway Station", output)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):        # Q or ESC → quit
            break
        elif key == ord("s"):            # S → screenshot
            fname = f"screenshot_{time.strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(fname, output)
            print(f"[Screenshot] Saved: {fname}")

    cap.release()
    cv2.destroyAllWindows()
    print("\n[System] Stopped.")


# =============================================================================
# Entry point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Real-Time Crowd Risk Detection System for Railway Stations"
    )
    parser.add_argument(
        "--camera", type=int, default=0,
        help="Camera ID from cameras.json (default: 0)"
    )
    parser.add_argument(
        "--video", type=str, default=None,
        help="Path to a video file (overrides --camera)"
    )
    parser.add_argument(
        "--list-cameras", action="store_true",
        help="List all cameras in cameras.json and exit"
    )
    args = parser.parse_args()

    cameras = load_cameras()

    if args.list_cameras:
        print("\nConfigured cameras:")
        for cam in cameras:
            print(f"  ID {cam['id']:>2} | {str(cam['source']):<40} | {cam['location']}")
        print()
        sys.exit(0)

    if args.video:
        # Use a video file (great for demos / offline testing)
        source   = args.video
        location = f"[Video] {os.path.basename(args.video)}"
    else:
        cam_entry = get_camera_entry(cameras, args.camera)
        source    = cam_entry["source"]
        location  = cam_entry["location"]

    run(source, location)


if __name__ == "__main__":
    main()
