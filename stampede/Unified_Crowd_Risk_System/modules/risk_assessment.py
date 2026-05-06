# =============================================================================
# modules/risk_assessment.py
# Per-cell and global risk scoring — stampede-appropriate logic
#
# Key design principles:
#   1. Density is the PRIMARY indicator — no stampede without a crowd.
#   2. Motion & disorder are GATED by local density — one person walking
#      fast does NOT trigger risk.
#   3. Global person count gates the maximum achievable risk level.
#   4. Temporal smoothing prevents momentary spikes from false-alerting.
# =============================================================================

import collections
import numpy as np
import config

# ── Risk level constants ──────────────────────────────────────────────────────
NORMAL      = "NORMAL"
MEDIUM_RISK = "MEDIUM RISK"
HIGH_RISK   = "HIGH RISK"

RISK_COLORS = {
    NORMAL:      config.COLOR_NORMAL,
    MEDIUM_RISK: config.COLOR_MEDIUM,
    HIGH_RISK:   config.COLOR_HIGH,
}

RISK_ALERTS = {
    NORMAL:      "Situation normal. No immediate action required.",
    MEDIUM_RISK: "Elevated crowd density detected. Monitor the area closely.",
    HIGH_RISK:   "STAMPEDE RISK! Chaotic crowd movement in high-density area. Take action NOW!",
}


class RiskAssessor:
    """
    Combines density + optical-flow into per-cell and global risk.

    The score formula uses density gating so that high motion/disorder
    values from a single person do NOT push the score above NORMAL.

        per-cell score = density_contribution
                       + motion_contribution  * density_gate
                       + disorder_contribution * density_gate

    where density_gate ramps 0→1 as density rises from 0 → DENSITY_MIN_FOR_MOTION.

    The global score is then temporally smoothed over RISK_SMOOTH_FRAMES
    before classification, preventing single-frame spikes.
    """

    def __init__(self):
        # Circular buffer for temporal smoothing of the global risk score
        self._score_buf = collections.deque(maxlen=config.RISK_SMOOTH_FRAMES)

    # ── Public API ────────────────────────────────────────────────────────────

    def assess(self, norm_density, flow_grid, global_person_count=0):
        """
        Parameters
        ----------
        norm_density        : np.ndarray (rows, cols) values 0.0–1.0
        flow_grid           : list[list[dict]]  — from OpticalFlowAnalyzer
        global_person_count : int — total people detected in the frame

        Returns
        -------
        risk_map    : list[list[dict]]  keys: level, score, color
        global_risk : str
        alert_msg   : str
        """
        rows = len(flow_grid)
        cols = len(flow_grid[0]) if rows > 0 else 0

        risk_map     = []
        instant_max  = 0.0   # worst per-cell score this frame (un-smoothed)

        for r in range(rows):
            row_risk = []
            for c in range(cols):
                cell          = flow_grid[r][c]
                density_score = float(norm_density[r][c])
                motion_var    = cell["variance"]
                disorder      = cell["disorder"]

                # ── Density contribution (always present) ─────────────────────
                density_contribution = config.DENSITY_WEIGHT * density_score

                # ── Density gate ──────────────────────────────────────────────
                # Ramps 0→1 as density goes from 0 → DENSITY_MIN_FOR_MOTION.
                # Below the gate, motion and disorder add ~0 to the score.
                density_gate = min(
                    density_score / max(config.DENSITY_MIN_FOR_MOTION, 1e-5),
                    1.0
                )

                # ── Motion & disorder contributions (gated) ───────────────────
                motion_contribution   = config.MOTION_WEIGHT   * motion_var  * density_gate
                disorder_contribution = config.DISORDER_WEIGHT * disorder    * density_gate

                # ── Raw cell score ────────────────────────────────────────────
                score = density_contribution + motion_contribution + disorder_contribution

                # ── False-alarm suppression for structured boarding flow ───────
                if disorder < config.DISORDER_THRESHOLD and self._is_bidirectional(cell):
                    score = config.DENSITY_WEIGHT * density_score * 0.5

                # ── Minimum-crowd ceiling ─────────────────────────────────────
                # A single occupied cell cannot escalate above NORMAL unless
                # there are enough people globally to constitute a crowd risk.
                score = self._apply_crowd_ceiling(score, global_person_count)

                score = round(float(np.clip(score, 0.0, 1.0)), 3)
                instant_max = max(instant_max, score)

                level = self._classify(score)
                row_risk.append({
                    "level": level,
                    "score": score,
                    "color": RISK_COLORS[level],
                })
            risk_map.append(row_risk)

        # ── Temporal smoothing of global score ────────────────────────────────
        self._score_buf.append(instant_max)
        smoothed_score = float(np.mean(self._score_buf))

        if global_person_count > 3:
            global_risk = HIGH_RISK
            alert_msg   = f"ALERT: Crowd Threshold Exceeded! ({global_person_count} people detected)"
        else:
            global_risk = self._classify(smoothed_score)
            alert_msg   = RISK_ALERTS[global_risk]
            
        return risk_map, global_risk, alert_msg

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _apply_crowd_ceiling(self, score, global_person_count):
        """
        Cap the achievable score based on how many people are in the frame.
        Prevents a 1-2 person scene from ever reaching HIGH or MEDIUM RISK.
        """
        if global_person_count < config.MIN_CROWD_FOR_MEDIUM:
            # Fewer people than medium threshold → cap below MEDIUM
            return min(score, config.RISK_MEDIUM_THRESHOLD - 0.01)
        if global_person_count < config.MIN_CROWD_FOR_HIGH:
            # Fewer people than high threshold → cap below HIGH
            return min(score, config.RISK_HIGH_THRESHOLD - 0.01)
        return score

    def _classify(self, score):
        if score >= config.RISK_HIGH_THRESHOLD:
            return HIGH_RISK
        elif score >= config.RISK_MEDIUM_THRESHOLD:
            return MEDIUM_RISK
        return NORMAL

    def _is_bidirectional(self, cell):
        """Structured boarding/deboarding: low disorder + meaningful magnitude."""
        return cell["mean_magnitude"] > config.FLOW_MIN_MAG
