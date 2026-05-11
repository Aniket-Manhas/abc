# =============================================================================
# modules/density.py
# Zone-based crowd density estimation.
# Computes persons/m² per grid cell using configurable zone area calibration.
# Works with YOLO boxes OR P2PNet point predictions.
# =============================================================================

import numpy as np
import config


class DensityEstimator:
    """
    Divides each frame into a GRID_ROWS × GRID_COLS grid and computes:
      - count per cell  (integer)
      - density per cell in persons/m²
      - global count and global density in persons/m²

    Parameters come from config.py (GRID_ROWS, GRID_COLS, ZONE_AREA_M2).
    """

    def __init__(self):
        self.rows = config.GRID_ROWS
        self.cols = config.GRID_COLS
        self.cell_area_m2 = config.cell_area_m2()

    # ── Public API ────────────────────────────────────────────────────────────

    def compute_from_boxes(self, frame, boxes):
        """
        Build density maps from YOLO bounding boxes.

        Parameters
        ----------
        frame : np.ndarray — current BGR frame (used for dimensions only)
        boxes : list of (x1, y1, x2, y2, conf)

        Returns
        -------
        See _compute()
        """
        # Use foot-point (bottom-centre) for grid placement
        points = [((x1 + x2) // 2, y2) for (x1, y1, x2, y2, _) in boxes]
        return self._compute(frame, points)

    def compute_from_points(self, frame, points):
        """
        Build density maps from P2PNet (x, y) head-point predictions.

        Parameters
        ----------
        frame  : np.ndarray
        points : list of (x, y)

        Returns
        -------
        See _compute()
        """
        return self._compute(frame, points)

    def normalize(self, density_map):
        """Returns a normalised 0–1 density map capped at MAX_PEOPLE_PER_CELL."""
        return np.clip(
            density_map.astype(float) / config.MAX_PEOPLE_PER_CELL,
            0.0, 1.0,
        )

    def get_zone_data(self, density_map_m2, risk_map):
        """
        Build per-zone summary list for the frontend.

        Returns
        -------
        list of {row, col, density_m2, risk_level}
        """
        zones = []
        for r in range(self.rows):
            for c in range(self.cols):
                d   = float(density_map_m2[r][c])
                lvl = risk_map[r][c]['level'] if risk_map else 'SAFE'
                zones.append({
                    'row':        r,
                    'col':        c,
                    'density_m2': round(d, 3),
                    'risk_level': lvl,
                })
        return zones

    # ── Internal ──────────────────────────────────────────────────────────────

    def _compute(self, frame, points):
        """
        Returns
        -------
        density_map      : np.ndarray (rows, cols) — count per cell
        density_map_m2   : np.ndarray (rows, cols) — persons per m² per cell
        global_count     : int
        global_density_m2: float
        """
        h, w   = frame.shape[:2]
        cell_h = h / self.rows
        cell_w = w / self.cols

        density_map = np.zeros((self.rows, self.cols), dtype=int)

        for (cx, cy) in points:
            row = min(int(cy / cell_h), self.rows - 1)
            col = min(int(cx / cell_w), self.cols - 1)
            density_map[row][col] += 1

        global_count      = int(np.sum(density_map))
        density_map_m2    = density_map.astype(float) / max(self.cell_area_m2, 1e-6)
        global_density_m2 = global_count / max(config.ZONE_AREA_M2, 1e-6)

        return density_map, density_map_m2, global_count, global_density_m2
