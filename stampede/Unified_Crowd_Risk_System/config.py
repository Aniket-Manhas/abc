# =============================================================================
# config.py — All tunable parameters for the Crowd Risk Detection System
# =============================================================================

# ── Grid Settings ─────────────────────────────────────────────────────────────
GRID_ROWS = 6          # Number of rows to divide the frame into
GRID_COLS = 6          # Number of columns to divide the frame into

# ── YOLO Detection ────────────────────────────────────────────────────────────
YOLO_MODEL_PATH = "yolov8s.pt"   # Path to YOLOv8 weights
YOLO_CONF       = 0.35           # Minimum confidence for detections (0–1)
YOLO_IMG_SIZE   = 640            # Higher size for better accuracy

# ── Performance / Lag Reduction ───────────────────────────────────────────────
PROCESS_WIDTH   = 1024  # Higher resolution for better detection
                        # (maintains aspect ratio; reduces YOLO + flow cost)
CAPTURE_BUFFER  = 1     # cv2.CAP_PROP_BUFFERSIZE — 1 = always get latest frame
DRAIN_FRAMES    = 4     # Stale frames to skip per update cycle (kills buffer lag)

# ── Risk Scoring Weights (must sum to 1.0) ────────────────────────────────────
DENSITY_WEIGHT  = 0.60   # Density is the PRIMARY stampede indicator
MOTION_WEIGHT   = 0.25   # Speed variance — secondary
DISORDER_WEIGHT = 0.15   # Directional chaos — secondary

# ── Risk Thresholds (normalised 0–1 score) ────────────────────────────────────
RISK_MEDIUM_THRESHOLD = 0.42   # Score above this → MEDIUM RISK  (was 0.35)
RISK_HIGH_THRESHOLD   = 0.72   # Score above this → HIGH RISK    (was 0.65)

# ── Stampede Requires a Crowd — Minimum Person Counts ─────────────────────────
# Even if scores are high, don't escalate without enough people in frame.
MIN_CROWD_FOR_MEDIUM = 3    # Need at least 3 detected people for MEDIUM RISK
MIN_CROWD_FOR_HIGH   = 8    # Need at least 8 detected people for HIGH RISK

# ── Density Gate for Motion/Disorder ─────────────────────────────────────────
# Motion and disorder only contribute to risk when density is also elevated.
# Below this normalised density, motion & disorder are suppressed.
# (prevents 1 person walking from triggering risk)
DENSITY_MIN_FOR_MOTION = 0.25   # ≈ 2–3 people per cell (with MAX=10)

# ── Temporal Smoothing ────────────────────────────────────────────────────────
# Risk score is averaged over the last N frames before thresholding.
# Prevents momentary spikes from causing false alerts.
RISK_SMOOTH_FRAMES  = 10    # Smooth over last 10 processed frames (~3–5 seconds)

# ── False-Alarm Suppression (Train Boarding) ──────────────────────────────────
DISORDER_THRESHOLD = 0.30   # Below this → considered structured flow

# ── Density Normalisation ─────────────────────────────────────────────────────
MAX_PEOPLE_PER_CELL = 8     # A cell with this many people = density score 1.0
                            # (was 10; lowered so 8 people = fully dense)

# ── Optical Flow ──────────────────────────────────────────────────────────────
FLOW_PYR_SCALE  = 0.5
FLOW_LEVELS     = 3
FLOW_WINSIZE    = 11    # Smaller window = faster (was 15)
FLOW_ITERATIONS = 2     # Fewer iterations = faster (was 3)
FLOW_POLY_N     = 5
FLOW_POLY_SIGMA = 1.1
FLOW_FLAGS      = 0

FLOW_SCALE      = 15
FLOW_MIN_MAG    = 0.8   # Raise noise floor (was 0.5) — ignore tiny motions

# ── Visualiser ────────────────────────────────────────────────────────────────
HEATMAP_ALPHA   = 0.40
DRAW_BBOXES     = False
DRAW_FLOW       = False
DRAW_HEATMAP    = True
DRAW_GRID_LINES = True

# ── Colour map (BGR) ──────────────────────────────────────────────────────────
COLOR_NORMAL      = (50,  205,  50)
COLOR_MEDIUM      = (0,   200, 255)
COLOR_HIGH        = (0,    50, 220)
COLOR_CRITICAL    = (0,     0, 180)
COLOR_ARROW       = (255, 255, 255)
COLOR_HUD_BG      = (20,   20,  20)
COLOR_HUD_TEXT    = (220, 220, 220)
