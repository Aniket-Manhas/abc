# =============================================================================
# utils/visualizer.py
# Renders crowd monitoring overlays on video frames:
#   - Density heatmap per grid cell (colour-coded by risk level)
#   - Grid lines
#   - Danger zone borders + labels
#   - P2PNet point predictions (head locations)
#   - YOLO bounding boxes (optional)
# =============================================================================

import cv2
import numpy as np
import config
from modules.risk_assessment import SAFE, WARNING, HIGH_RISK, DANGER


class Visualizer:
    def __init__(self):
        pass

    def render(self, frame, boxes, tracked_objects, risk_map, flow_grid,
               p2pnet_points=None, using_p2pnet=False):
        """
        Returns a new annotated frame with all overlays applied.

        Parameters
        ----------
        frame          : np.ndarray  — original BGR frame
        boxes          : list        — YOLO boxes (x1,y1,x2,y2,conf)
        tracked_objects: dict        — {id: (cx,cy)} from TrackerWrapper
        risk_map       : list[list]  — per-cell risk dicts
        flow_grid      : list[list]  — per-cell flow dicts
        p2pnet_points  : list|(x,y)  — P2PNet head predictions (optional)
        using_p2pnet   : bool        — whether P2PNet count is active
        """
        out = frame.copy()
        h, w = out.shape[:2]
        rows, cols = config.GRID_ROWS, config.GRID_COLS

        # Pre-compute exact pixel boundaries for each row/col
        row_starts = [int(r * h / rows) for r in range(rows)] + [h]
        col_starts = [int(c * w / cols) for c in range(cols)] + [w]

        if config.DRAW_HEATMAP and risk_map:
            out = self._draw_heatmap(out, risk_map, row_starts, col_starts)

        if config.DRAW_GRID_LINES:
            out = self._draw_grid(out, h, w, row_starts, col_starts)

        if config.DRAW_FLOW and flow_grid:
            out = self._draw_flow_arrows(out, flow_grid, row_starts, col_starts)

        if risk_map:
            out = self._draw_danger_boxes(out, risk_map, row_starts, col_starts)

        # P2PNet points → small red dots per detected head
        if config.DRAW_P2PNET_POINTS and p2pnet_points:
            out = self._draw_p2pnet_points(out, p2pnet_points)
        elif config.DRAW_BBOXES and not using_p2pnet:
            out = self._draw_tracking(out, boxes, tracked_objects)

        return out

    # ── HUD overlay ───────────────────────────────────────────────────────────

    def draw_hud(self, frame, person_count, risk_level, using_p2pnet, density_m2=0.0):
        """Draws a semi-transparent HUD bar at the top of the frame."""
        h, w = frame.shape[:2]
        bar_h = 36
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, bar_h), (10, 10, 20), -1)
        frame = cv2.addWeighted(overlay, 0.72, frame, 0.28, 0)

        # Risk colour
        risk_colors = {
            'SAFE':      (50, 205, 50),
            'WARNING':   (0, 200, 255),
            'HIGH RISK': (0, 120, 255),
            'DANGER':    (0, 0, 220),
        }
        rc = risk_colors.get(risk_level, (180, 180, 180))

        model_tag = '⬡ P2PNet' if using_p2pnet else '⬡ YOLO'
        hud_text  = f" {model_tag}   Persons: {person_count}   Density: {density_m2:.2f} p/m²   [{risk_level}]"
        cv2.putText(frame, hud_text, (8, 24),
                    cv2.FONT_HERSHEY_DUPLEX, 0.52, rc, 1, cv2.LINE_AA)
        return frame

    # ── P2PNet head points ────────────────────────────────────────────────────

    def _draw_p2pnet_points(self, frame, points):
        for (px, py) in points:
            # Outer ring
            cv2.circle(frame, (px, py), 5, (0, 0, 200), -1)
            # Inner bright dot
            cv2.circle(frame, (px, py), 2, (0, 100, 255), -1)
        return frame

    # ── YOLO tracking (used when P2PNet is off) ───────────────────────────────

    def _draw_tracking(self, frame, boxes, tracked_objects):
        for (x1, y1, x2, y2, _) in boxes:
            color = (0, 255, 150)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1)
            ln, th = 15, 3
            cv2.line(frame, (x1, y1), (x1 + ln, y1), color, th)
            cv2.line(frame, (x1, y1), (x1, y1 + ln), color, th)
            cv2.line(frame, (x2, y1), (x2 - ln, y1), color, th)
            cv2.line(frame, (x2, y1), (x2, y1 + ln), color, th)
            cv2.line(frame, (x1, y2), (x1 + ln, y2), color, th)
            cv2.line(frame, (x1, y2), (x1, y2 - ln), color, th)
            cv2.line(frame, (x2, y2), (x2 - ln, y2), color, th)
            cv2.line(frame, (x2, y2), (x2, y2 - ln), color, th)
        for (oid, centroid) in tracked_objects.items():
            cv2.circle(frame, (centroid[0], centroid[1]), 3, (0, 255, 255), -1)
            cv2.putText(frame, f"ID:{oid}", (centroid[0] - 10, centroid[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
        return frame

    # ── Heatmap ───────────────────────────────────────────────────────────────

    def _draw_heatmap(self, frame, risk_map, row_starts, col_starts):
        overlay = frame.copy()
        for r, row in enumerate(risk_map):
            for c, cell in enumerate(row):
                x0, y0 = col_starts[c], row_starts[r]
                x1, y1 = col_starts[c + 1], row_starts[r + 1]
                cv2.rectangle(overlay, (x0, y0), (x1 - 1, y1 - 1), cell['color'], -1)
        return cv2.addWeighted(overlay, config.HEATMAP_ALPHA,
                               frame, 1 - config.HEATMAP_ALPHA, 0)

    # ── Grid lines ────────────────────────────────────────────────────────────

    def _draw_grid(self, frame, h, w, row_starts, col_starts):
        overlay = frame.copy()
        for y in row_starts[1:-1]:          # skip 0 and h (frame edges)
            cv2.line(overlay, (0, y), (w, y), (255, 255, 255), 1)
        for x in col_starts[1:-1]:          # skip 0 and w
            cv2.line(overlay, (x, 0), (x, h), (255, 255, 255), 1)
        return cv2.addWeighted(overlay, 0.18, frame, 0.82, 0)

    # ── Flow arrows ───────────────────────────────────────────────────────────

    def _draw_flow_arrows(self, frame, flow_grid, row_starts, col_starts):
        for r, row in enumerate(flow_grid):
            for c, cell in enumerate(row):
                if cell['mean_magnitude'] < config.FLOW_MIN_MAG:
                    continue
                angle_rad = np.deg2rad(cell['mean_angle'])
                cx = (col_starts[c] + col_starts[c + 1]) // 2
                cy = (row_starts[r] + row_starts[r + 1]) // 2
                cell_w = col_starts[c + 1] - col_starts[c]
                cell_h = row_starts[r + 1] - row_starts[r]
                alen = int(min(cell['mean_magnitude'] * config.FLOW_SCALE,
                               min(cell_w, cell_h) * 0.45))
                ex = int(cx + alen * np.cos(angle_rad))
                ey = int(cy + alen * np.sin(angle_rad))
                cv2.arrowedLine(frame, (cx, cy), (ex, ey),
                                config.COLOR_ARROW, 2, tipLength=0.35)
        return frame

    # ── Danger zone borders + density label ───────────────────────────────────

    def _draw_danger_boxes(self, frame, risk_map, row_starts, col_starts):
        for r, row in enumerate(risk_map):
            for c, cell in enumerate(row):
                level = cell['level']
                if level == SAFE:
                    continue

                color = {
                    WARNING:   config.COLOR_WARNING,
                    HIGH_RISK: config.COLOR_HIGH,
                    DANGER:    config.COLOR_DANGER,
                }.get(level, config.COLOR_WARNING)

                thickness = 3 if level in (HIGH_RISK, DANGER) else 2
                x0, y0 = col_starts[c], row_starts[r]
                x1, y1 = col_starts[c + 1] - 1, row_starts[r + 1] - 1
                cv2.rectangle(frame, (x0, y0), (x1, y1), color, thickness)

                # Density label (p/m²)
                d_label = f"{cell.get('density_m2', 0):.1f}"
                (tw, th), _ = cv2.getTextSize(
                    d_label, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
                cv2.rectangle(frame, (x0, y0), (x0 + tw + 4, y0 + th + 4), color, -1)
                cv2.putText(frame, d_label, (x0 + 2, y0 + th + 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1, cv2.LINE_AA)
        return frame
