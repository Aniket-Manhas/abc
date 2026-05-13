# =============================================================================
# config.py — Tunable parameters for the AI Crowd Density Monitoring System
# =============================================================================
import os
from dotenv import load_dotenv

# Load .env variables if present
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
YOLO_CONF       = 0.20          # Lower threshold → catches more partially occluded people
YOLO_IMG_SIZE   = 960           # Higher resolution → better detection of small/distant persons

# ── P2PNet Settings (dense crowd counting) ───────────────────────────────────
P2PNET_DIR      = os.path.abspath(os.path.join(_THIS_DIR, '..', '..', '..', 'CrowdCounting-P2PNet'))
P2PNET_WEIGHTS  = os.path.join(P2PNET_DIR, 'weights', 'SHTechA.pth')
P2PNET_ENABLED  = True
P2PNET_THRESHOLD = 0.35       # Lower → more head points detected in dense crowds
P2PNET_INTERVAL  = 8          # Run P2PNet every N frames even if below dense threshold
DENSE_THRESHOLD  = 6          # Switch to P2PNet when YOLO sees >= 6 persons (was 12)

# ── Zone Area Calibration ─────────────────────────────────────────────────────
# Estimated real-world area visible in the camera frame (square meters).
# Tune per camera using: area = (frame_width_m * frame_height_m) from site survey.
ZONE_AREA_M2    = 50.0        # Total monitored area in m² (default: 50 m² FOV)

# Derived: area per grid cell
def cell_area_m2():
    return ZONE_AREA_M2 / (GRID_ROWS * GRID_COLS)

# ── Risk Density Thresholds (persons per m²) ──────────────────────────────────
# Based on Fruin's Level of Service model for pedestrian density:
DENSITY_SAFE      = 1.0   # < 1.0 p/m²  → SAFE       (free movement)
DENSITY_WARNING   = 2.0   # 1.0–2.0     → WARNING     (restricted movement)
DENSITY_HIGH_RISK = 4.0   # 2.0–4.0     → HIGH RISK   (dangerous compression)
DENSITY_DANGER    = 6.0   # ≥ 4.0       → DANGER      (crush risk / stampede)

# ---Risk alram testing of device make sure to cooment these and uncomment the normal risk thresholds---
# DENSITY_SAFE = 0.01
# DENSITY_WARNING = 0.02
# DENSITY_HIGH_RISK = 0.03
# DENSITY_DANGER = 0.04

# ── Performance / Lag Reduction ───────────────────────────────────────────────
# 640 px → YOLO runs ~30-80 ms/frame on a laptop (was 1280 = 150-300 ms → major lag source)
# Increase to 960 or 1280 only if running on a machine with a dedicated GPU.
PROCESS_WIDTH   = 640
CAPTURE_BUFFER  = 1             # Always keep 1; larger values cause stale-frame backlog

# ── Risk Scoring Weights ──────────────────────────────────────────────────────
DENSITY_WEIGHT  = 0.60
MOTION_WEIGHT   = 0.25
DISORDER_WEIGHT = 0.15

# ── Temporal Smoothing ────────────────────────────────────────────────────────
RISK_SMOOTH_FRAMES     = 10
DENSITY_MIN_FOR_MOTION = 0.25

# ── Density Normalisation (for heatmap, not risk thresholds) ─────────────────
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
DRAW_HEATMAP    = False        # No colour fill on cells — raw video only
DRAW_GRID_LINES = True
DRAW_P2PNET_POINTS = True

# ── Colour map (BGR) ──────────────────────────────────────────────────────────
COLOR_SAFE        = (50,  205,  50)    # Green
COLOR_WARNING     = (0,   200, 255)    # Yellow-ish
COLOR_HIGH        = (0,   100, 255)    # Orange
COLOR_DANGER      = (0,     0, 220)    # Red
COLOR_ARROW       = (255, 255, 255)
COLOR_HUD_BG      = (20,   20,  20)
COLOR_HUD_TEXT    = (220, 220, 220)

# Legacy aliases for compatibility
COLOR_NORMAL   = COLOR_SAFE
COLOR_MEDIUM   = COLOR_WARNING
COLOR_CRITICAL = COLOR_DANGER
