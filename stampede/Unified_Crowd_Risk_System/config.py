# =============================================================================
# config.py — Tunable parameters for the AI Crowd Density Monitoring System
# =============================================================================
import os
from dotenv import load_dotenv

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_THIS_DIR, '.env'))

# ── Email Settings ────────────────────────────────────────────────────────────
ENABLE_EMAIL_ALERTS = os.environ.get("ENABLE_EMAIL_ALERTS", "False").lower() == "true"
MAIL_SERVER         = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT           = int(os.environ.get("MAIL_PORT", 587))
MAIL_USERNAME       = os.environ.get("MAIL_USERNAME", "")
MAIL_PASSWORD       = os.environ.get("MAIL_PASSWORD", "")
ADMIN_ALERT_EMAIL   = os.environ.get("ADMIN_ALERT_EMAIL", "")

# ── Grid Settings ─────────────────────────────────────────────────────────────
GRID_ROWS = 6
GRID_COLS = 6

# ── YOLO Detection (sparse/medium crowds) ─────────────────────────────────────
YOLO_MODEL_PATH = "yolov8s.pt"
YOLO_CONF       = 0.20
YOLO_IMG_SIZE   = 960

# ── Hybrid switch: YOLO if count < 10, else P2PNet ───────────────────────────
DENSE_THRESHOLD  = 10

# ── P2PNet paths (override with P2PNET_DIR env var) ───────────────────────────
def _default_p2pnet_dir():
    env = os.environ.get("P2PNET_DIR")
    if env and os.path.isdir(env):
        return os.path.abspath(env)
    candidates = [
        os.path.join(_THIS_DIR, "CrowdCounting-P2PNet"),
        os.path.join(_THIS_DIR, "..", "CrowdCounting-P2PNet"),
        os.path.join(_THIS_DIR, "..", "..", "CrowdCounting-P2PNet"),
        os.path.abspath(os.path.join(_THIS_DIR, "..", "..", "..", "CrowdCounting-P2PNet")),
    ]
    for path in candidates:
        if os.path.isdir(path):
            return os.path.abspath(path)
    return os.path.abspath(os.path.join(_THIS_DIR, "CrowdCounting-P2PNet"))


P2PNET_DIR      = _default_p2pnet_dir()
P2PNET_WEIGHTS  = os.path.join(P2PNET_DIR, "weights", "SHTechA.pth")
P2PNET_ENABLED  = True
P2PNET_THRESHOLD = 0.25       # Default; SHTech demo uses 0.5 — lower helps dense scenes
P2PNET_INTERVAL  = 8

# P2PNet runs on FULL frame — never downscale to PROCESS_WIDTH (that caused ~21 counts)
P2PNET_USE_TILING       = True
P2PNET_TILE_SIZE        = 1280    # px per tile (multiple of 128)
P2PNET_TILE_OVERLAP     = 192     # px overlap between tiles
P2PNET_TILE_MIN_EDGE    = 1536    # Use tiling when max(h,w) exceeds this
P2PNET_MAX_SINGLE_EDGE  = 2560    # Cap single-pass resize (memory); tiling handles larger
P2PNET_MERGE_DIST       = 10      # px — dedupe overlapping tile detections
P2PNET_MULTISCALE       = (1.0,)  # Add 0.75, 1.25 for harder scenes (slower)
P2PNET_DEBUG            = os.environ.get("P2PNET_DEBUG", "").lower() in ("1", "true", "yes")

# ── Zone Area Calibration ─────────────────────────────────────────────────────
ZONE_AREA_M2    = 50.0

def cell_area_m2():
    return ZONE_AREA_M2 / (GRID_ROWS * GRID_COLS)

# ── Risk Density Thresholds (persons per m²) ──────────────────────────────────
DENSITY_SAFE      = 1.0
DENSITY_WARNING   = 2.0
DENSITY_HIGH_RISK = 4.0
DENSITY_DANGER    = 6.0

# DENSITY_SAFE      = 0.0
# DENSITY_WARNING   = 0.0
# DENSITY_HIGH_RISK = 0.0
# DENSITY_DANGER    = 0.0


# ── Performance (YOLO only — P2PNet uses full resolution / tiles) ─────────────
PROCESS_WIDTH   = 640
CAPTURE_BUFFER  = 1

# ── Risk Scoring Weights ──────────────────────────────────────────────────────
DENSITY_WEIGHT  = 0.60
MOTION_WEIGHT   = 0.25
DISORDER_WEIGHT = 0.15

RISK_SMOOTH_FRAMES     = 10
DENSITY_MIN_FOR_MOTION = 0.25
MAX_PEOPLE_PER_CELL = 8

# ── Optical Flow ──────────────────────────────────────────────────────────────
FLOW_PYR_SCALE  = 0.5
FLOW_LEVELS     = 3
FLOW_WINSIZE    = 11
FLOW_ITERATIONS = 2
FLOW_POLY_N     = 5
FLOW_POLY_SIGMA = 1.1
FLOW_FLAGS      = 0
FLOW_SCALE      = 15
FLOW_MIN_MAG    = 0.8

# ── Visualiser ────────────────────────────────────────────────────────────────
HEATMAP_ALPHA   = 0.38
DRAW_BBOXES     = False
DRAW_FLOW       = False
DRAW_HEATMAP    = False
DRAW_GRID_LINES = True
DRAW_P2PNET_POINTS = True

COLOR_SAFE        = (50,  205,  50)
COLOR_WARNING     = (0,   200, 255)
COLOR_HIGH        = (0,   100, 255)
COLOR_DANGER      = (0,     0, 220)
COLOR_ARROW       = (255, 255, 255)
COLOR_HUD_BG      = (20,   20,  20)
COLOR_HUD_TEXT    = (220, 220, 220)
COLOR_NORMAL   = COLOR_SAFE
COLOR_MEDIUM   = COLOR_WARNING
COLOR_CRITICAL = COLOR_DANGER
