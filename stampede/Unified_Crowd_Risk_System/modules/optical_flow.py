# =============================================================================
# modules/optical_flow.py
# Dense optical flow (Farneback) — per-cell motion analysis
# =============================================================================

import cv2
import numpy as np
import config


class OpticalFlowAnalyzer:
    """
    Computes Farneback dense optical flow between consecutive frames and
    summarises motion per grid cell.

    Each cell returns a FlowCell dict:
        mean_angle     : float (degrees 0–360)        — dominant direction
        mean_magnitude : float                         — average speed
        variance       : float (normalised 0–1)        — speed variance
        disorder       : float (0–1, circular variance)— directional chaos
                          0 → all moving same direction (structured)
                          1 → completely random (chaotic / stampede risk)

    Usage:
        analyzer = OpticalFlowAnalyzer()
        flow_grid = analyzer.analyze(frame)   # call every frame
    """

    def __init__(self):
        self.rows = config.GRID_ROWS
        self.cols = config.GRID_COLS
        self.prev_gray = None

    def _circular_variance(self, angles_deg):
        """
        Circular variance of angles in degrees.
        Returns 0 if all angles point the same way, 1 if completely random.
        """
        if len(angles_deg) == 0:
            return 0.0
        angles_rad = np.deg2rad(angles_deg)
        mean_cos = np.mean(np.cos(angles_rad))
        mean_sin = np.mean(np.sin(angles_rad))
        R = np.sqrt(mean_cos ** 2 + mean_sin ** 2)  # resultant vector length
        return float(1.0 - R)  # 0=perfectly aligned, 1=completely random

    def analyze(self, frame):
        """
        Parameters
        ----------
        frame : np.ndarray — current BGR frame

        Returns
        -------
        flow_grid : list of lists (rows × cols) of dict with keys:
                    mean_angle, mean_magnitude, variance, disorder
        None is returned for the first frame (no previous frame yet).
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Initialise on first call
        if self.prev_gray is None:
            self.prev_gray = gray
            return self._empty_grid()

        # Compute dense optical flow
        flow = cv2.calcOpticalFlowFarneback(
            self.prev_gray,
            gray,
            None,
            config.FLOW_PYR_SCALE,
            config.FLOW_LEVELS,
            config.FLOW_WINSIZE,
            config.FLOW_ITERATIONS,
            config.FLOW_POLY_N,
            config.FLOW_POLY_SIGMA,
            config.FLOW_FLAGS,
        )
        self.prev_gray = gray

        h, w = frame.shape[:2]
        cell_h = h / self.rows
        cell_w = w / self.cols

        flow_grid = []
        for r in range(self.rows):
            row_data = []
            for c in range(self.cols):
                # Extract flow vectors inside this cell
                y0, y1 = int(r * cell_h), int((r + 1) * cell_h)
                x0, x1 = int(c * cell_w), int((c + 1) * cell_w)
                cell_flow = flow[y0:y1, x0:x1]          # shape (cell_h, cell_w, 2)

                vx = cell_flow[..., 0].flatten()
                vy = cell_flow[..., 1].flatten()

                magnitudes = np.sqrt(vx ** 2 + vy ** 2)
                angles_deg = np.degrees(np.arctan2(vy, vx)) % 360  # 0–360

                # Filter out near-zero (background noise) vectors
                mask = magnitudes >= config.FLOW_MIN_MAG
                if mask.sum() == 0:
                    row_data.append(self._empty_cell())
                    continue

                active_mag = magnitudes[mask]
                active_ang = angles_deg[mask]

                mean_mag = float(np.mean(active_mag))
                # Normalise variance: cap at mean_mag so it stays 0–1
                var_raw   = float(np.var(active_mag))
                variance  = float(np.clip(var_raw / (mean_mag ** 2 + 1e-5), 0, 1))
                disorder  = self._circular_variance(active_ang)

                # Mean angle from circular mean
                mean_angle = float(
                    np.degrees(np.arctan2(np.mean(np.sin(np.deg2rad(active_ang))),
                                          np.mean(np.cos(np.deg2rad(active_ang))))) % 360
                )

                row_data.append({
                    "mean_angle":     mean_angle,
                    "mean_magnitude": mean_mag,
                    "variance":       variance,
                    "disorder":       disorder,
                })
            flow_grid.append(row_data)

        return flow_grid

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _empty_cell(self):
        return {"mean_angle": 0.0, "mean_magnitude": 0.0, "variance": 0.0, "disorder": 0.0}

    def _empty_grid(self):
        return [[self._empty_cell() for _ in range(self.cols)] for _ in range(self.rows)]
