# =============================================================================
# modules/risk_assessment.py
# 4-level crowd risk assessment based on physical crowd density (persons/m²).
# Levels: SAFE → WARNING → HIGH RISK → DANGER
# Also uses optical flow for dynamic risk factors (growth rate, stagnation).
# =============================================================================

import collections
import numpy as np
import config

# ── Risk level constants ──────────────────────────────────────────────────────
SAFE      = "SAFE"
WARNING   = "WARNING"
HIGH_RISK = "HIGH RISK"
DANGER    = "DANGER"

RISK_COLORS = {
    SAFE:      config.COLOR_SAFE,
    WARNING:   config.COLOR_WARNING,
    HIGH_RISK: config.COLOR_HIGH,
    DANGER:    config.COLOR_DANGER,
}

RISK_ALERTS = {
    SAFE:
        "Situation normal. Crowd density within safe limits.",
    WARNING:
        "Elevated crowd density detected. Monitor area closely. Station staff on standby.",
    HIGH_RISK:
        "HIGH RISK: Crowd density exceeding safe thresholds. Initiate crowd management protocols immediately.",
    DANGER:
        "⚠️ DANGER: Critical crowd density! Immediate intervention required — risk of crowd crush!",
}

# Numeric scores for comparison
_LEVEL_ORDER = {SAFE: 0, WARNING: 1, HIGH_RISK: 2, DANGER: 3}


class RiskAssessor:
    """
    Combines density (persons/m²) + optical flow into per-cell and global risk.

    Density thresholds (from config):
        < DENSITY_SAFE      → SAFE
        < DENSITY_WARNING   → WARNING
        < DENSITY_HIGH_RISK → HIGH RISK
        ≥ DENSITY_HIGH_RISK → DANGER

    Dynamic amplifiers applied to global score:
        • Rapid crowd growth (surge detection)
        • Stagnation (high density + low motion = crush pressure building)
    """

    def __init__(self):
        self._score_buf          = collections.deque(maxlen=config.RISK_SMOOTH_FRAMES)
        self._prev_global_count  = 0
        self._stagnation_frames  = 0

    # ── Public API ────────────────────────────────────────────────────────────

    def assess(self, density_map_m2, norm_density, flow_grid,
               global_count=0, global_density_m2=0.0):
        """
        Parameters
        ----------
        density_map_m2    : np.ndarray (rows, cols) — persons/m² per cell
        norm_density      : np.ndarray (rows, cols) — normalized 0–1 count
        flow_grid         : list[list[dict]]  — from OpticalFlowAnalyzer (may be [])
        global_count      : int   — total persons detected
        global_density_m2 : float — total persons / total zone area

        Returns
        -------
        risk_map     : list[list[dict]]  keys: level, density_m2, color
        global_risk  : str  — SAFE / WARNING / HIGH RISK / DANGER
        alert_msg    : str
        risk_score   : float 0–100
        """
        rows = config.GRID_ROWS
        cols = config.GRID_COLS
        risk_map     = []

        for r in range(rows):
            row_risk = []
            for c in range(cols):
                d_m2 = float(density_map_m2[r][c]) if density_map_m2 is not None else 0.0

                # Flow-based disorder modifier per cell
                disorder_boost = 0.0
                if flow_grid and r < len(flow_grid) and c < len(flow_grid[r]):
                    cell       = flow_grid[r][c]
                    d_norm     = float(norm_density[r][c]) if norm_density is not None else 0.0
                    d_gate     = min(d_norm / max(config.DENSITY_MIN_FOR_MOTION, 1e-5), 1.0)
                    # Disorder adds at most +0.5 p/m² equivalent at full gate
                    disorder_boost = cell['disorder'] * d_gate * 0.5

                level = self._classify_m2(d_m2 + disorder_boost)
                row_risk.append({
                    'level':      level,
                    'density_m2': round(d_m2, 2),
                    'color':      RISK_COLORS[level],
                    'score':      round(min(d_m2 / max(config.DENSITY_HIGH_RISK, 1e-5), 1.0), 3),
                })
            risk_map.append(row_risk)

        # ── Global risk score (0–100) ─────────────────────────────────────────
        base = min((global_density_m2 / max(config.DENSITY_DANGER, 1e-5)) * 100.0, 100.0)

        # Growth-rate boost (sudden surge)
        growth = max(global_count - self._prev_global_count, 0)
        growth_boost = min(growth * 2.0, 20.0)
        self._prev_global_count = global_count

        # Stagnation boost
        avg_mag = 0.0
        if flow_grid:
            all_mags = [
                flow_grid[r][c]['mean_magnitude']
                for r in range(min(len(flow_grid), rows))
                for c in range(min(len(flow_grid[r]), cols))
            ]
            avg_mag = float(np.mean(all_mags)) if all_mags else 0.0

        if global_density_m2 > config.DENSITY_WARNING and avg_mag < 0.5:
            self._stagnation_frames += 1
        else:
            self._stagnation_frames = max(0, self._stagnation_frames - 1)
        stagnation_boost = min(self._stagnation_frames * 0.5, 15.0)

        raw_score = base + growth_boost + stagnation_boost
        self._score_buf.append(raw_score)
        risk_score = round(float(np.mean(self._score_buf)), 1)
        risk_score = min(risk_score, 100.0)

        # Global risk level from density + boosted score
        global_risk = self._classify_m2(global_density_m2)
        # If score is very high, escalate at least to HIGH RISK
        if risk_score >= 70 and _LEVEL_ORDER[global_risk] < _LEVEL_ORDER[HIGH_RISK]:
            global_risk = HIGH_RISK
        if risk_score >= 90 and _LEVEL_ORDER[global_risk] < _LEVEL_ORDER[DANGER]:
            global_risk = DANGER

        alert_msg = RISK_ALERTS[global_risk]
        if global_risk == DANGER:
            alert_msg = f"⚠️ DANGER: {global_count} persons detected @ {global_density_m2:.2f} p/m². IMMEDIATE ACTION REQUIRED!"
        elif global_risk == HIGH_RISK:
            alert_msg = f"HIGH RISK: {global_count} persons @ {global_density_m2:.2f} p/m². Initiate crowd control now."

        return risk_map, global_risk, alert_msg, risk_score

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _classify_m2(self, density_m2):
        """Map density (p/m²) to risk level using Fruin LOS thresholds."""
        if density_m2 >= config.DENSITY_DANGER:
            return DANGER
        if density_m2 >= config.DENSITY_HIGH_RISK:
            return HIGH_RISK
        if density_m2 >= config.DENSITY_SAFE:
            return WARNING
        return SAFE
