# =============================================================================
# modules/density.py
# Grid-based crowd density estimation from YOLO bounding boxes
# Adapted from: Crowd_Density_Estimator/backend/dashboard_app.py
# =============================================================================

import numpy as np
import config


class DensityEstimator:
    """
    Divides each frame into a GRID_ROWS × GRID_COLS grid and counts
    how many people are present in each cell.

    Usage:
        estimator = DensityEstimator()
        density_map, global_count = estimator.compute(frame, boxes)
        # density_map[row][col] → integer count
        # global_count          → total people in frame
    """

    def __init__(self):
        self.rows = config.GRID_ROWS
        self.cols = config.GRID_COLS

    def compute(self, frame, boxes):
        """
        Parameters
        ----------
        frame : np.ndarray  — current BGR frame (used only for dimensions)
        boxes : list of (x1, y1, x2, y2, conf)

        Returns
        -------
        density_map  : np.ndarray shape (rows, cols) — count per cell
        global_count : int — total people detected
        """
        h, w = frame.shape[:2]
        cell_h = h / self.rows
        cell_w = w / self.cols

        density_map = np.zeros((self.rows, self.cols), dtype=int)

        for (x1, y1, x2, y2, _conf) in boxes:
            # Use the bottom-centre of the bounding box as the person's position
            cx = (x1 + x2) // 2
            cy = y2          # feet position — more accurate for location

            row = min(int(cy / cell_h), self.rows - 1)
            col = min(int(cx / cell_w), self.cols - 1)
            density_map[row][col] += 1

        global_count = len(boxes)
        return density_map, global_count

    def normalize(self, density_map):
        """
        Returns a normalised density map (0.0 – 1.0) per cell,
        capped at MAX_PEOPLE_PER_CELL.
        """
        return np.clip(
            density_map.astype(float) / config.MAX_PEOPLE_PER_CELL,
            0.0,
            1.0,
        )
