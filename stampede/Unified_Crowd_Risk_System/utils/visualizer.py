# =============================================================================
# utils/visualizer.py
# Premium Surveillance Drawing: heatmap, flow arrows, danger boxes, tracking IDs.
# Note: HUD is removed from OpenCV frame since it will be rendered in HTML!
# =============================================================================

import cv2
import numpy as np
import config
from modules.risk_assessment import NORMAL, MEDIUM_RISK, HIGH_RISK


class Visualizer:
    def __init__(self):
        # We can store some persistent UI state here if needed
        pass

    def render(self, frame, boxes, tracked_objects, risk_map, flow_grid):
        """
        Returns a new frame with all overlays drawn.
        Designed to look like a high-end surveillance feed.
        """
        out = frame.copy()
        h, w = out.shape[:2]
        rows = config.GRID_ROWS
        cols = config.GRID_COLS
        cell_h = h // rows
        cell_w = w // cols

        if config.DRAW_HEATMAP:
            out = self._draw_heatmap(out, risk_map, cell_h, cell_w, rows, cols)

        if config.DRAW_GRID_LINES:
            out = self._draw_grid(out, h, w, cell_h, cell_w, rows, cols)

        if config.DRAW_FLOW:
            out = self._draw_flow_arrows(out, flow_grid, cell_h, cell_w, rows, cols)

        out = self._draw_danger_boxes(out, risk_map, cell_h, cell_w, rows, cols)

        if config.DRAW_BBOXES:
            out = self._draw_tracking(out, boxes, tracked_objects)

        # Draw a sleek cyber-terminal border
        cv2.rectangle(out, (0, 0), (w, h), (0, 255, 100), 2)
        return out

    # ── Tracking (Premium Style) ──────────────────────────────────────────────
    def _draw_tracking(self, frame, boxes, tracked_objects):
        # Draw bounding boxes (corners only for premium look)
        for (x1, y1, x2, y2, conf) in boxes:
            color = (0, 255, 150) # Cyber Green
            
            # Draw standard box very faintly
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1)
            
            # Draw thicker corners
            length = 15
            thickness = 3
            # Top-left
            cv2.line(frame, (x1, y1), (x1 + length, y1), color, thickness)
            cv2.line(frame, (x1, y1), (x1, y1 + length), color, thickness)
            # Top-right
            cv2.line(frame, (x2, y1), (x2 - length, y1), color, thickness)
            cv2.line(frame, (x2, y1), (x2, y1 + length), color, thickness)
            # Bottom-left
            cv2.line(frame, (x1, y2), (x1 + length, y2), color, thickness)
            cv2.line(frame, (x1, y2), (x1, y2 - length), color, thickness)
            # Bottom-right
            cv2.line(frame, (x2, y2), (x2 - length, y2), color, thickness)
            cv2.line(frame, (x2, y2), (x2, y2 - length), color, thickness)

        # Draw IDs
        for (objectID, centroid) in tracked_objects.items():
            text = f"ID: {objectID}"
            # small aesthetic dot in the center
            cv2.circle(frame, (centroid[0], centroid[1]), 3, (0, 255, 255), -1)
            cv2.putText(frame, text, (centroid[0] - 10, centroid[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
        return frame

    # ── Heatmap overlay ───────────────────────────────────────────────────────
    def _draw_heatmap(self, frame, risk_map, cell_h, cell_w, rows, cols):
        overlay = frame.copy()
        for r in range(rows):
            for c in range(cols):
                cell  = risk_map[r][c]
                color = cell["color"]
                x0, y0 = c * cell_w, r * cell_h
                x1, y1 = x0 + cell_w, y0 + cell_h
                cv2.rectangle(overlay, (x0, y0), (x1, y1), color, -1)
        return cv2.addWeighted(overlay, config.HEATMAP_ALPHA, frame, 1 - config.HEATMAP_ALPHA, 0)

    # ── Grid borders ──────────────────────────────────────────────────────────
    def _draw_grid(self, frame, h, w, cell_h, cell_w, rows, cols):
        grid_color = (255, 255, 255) # White but later alpha-blended or thin
        overlay = frame.copy()
        for r in range(1, rows):
            cv2.line(overlay, (0, r * cell_h), (w, r * cell_h), grid_color, 1)
        for c in range(1, cols):
            cv2.line(overlay, (c * cell_w, 0), (c * cell_w, h), grid_color, 1)
        return cv2.addWeighted(overlay, 0.2, frame, 0.8, 0)  # faint grid

    # ── Flow arrows ───────────────────────────────────────────────────────────
    def _draw_flow_arrows(self, frame, flow_grid, cell_h, cell_w, rows, cols):
        for r in range(rows):
            for c in range(cols):
                cell = flow_grid[r][c]
                mag  = cell["mean_magnitude"]
                if mag < config.FLOW_MIN_MAG:
                    continue

                angle_rad = np.deg2rad(cell["mean_angle"])
                cx = int(c * cell_w + cell_w / 2)
                cy = int(r * cell_h + cell_h / 2)

                arrow_len = int(min(mag * config.FLOW_SCALE, min(cell_w, cell_h) * 0.45))
                ex = int(cx + arrow_len * np.cos(angle_rad))
                ey = int(cy + arrow_len * np.sin(angle_rad))

                cv2.arrowedLine(frame, (cx, cy), (ex, ey),
                                config.COLOR_ARROW, 2, tipLength=0.35)
        return frame

    # ── Danger-zone highlights ────────────────────────────────────────────────
    def _draw_danger_boxes(self, frame, risk_map, cell_h, cell_w, rows, cols):
        for r in range(rows):
            for c in range(cols):
                cell  = risk_map[r][c]
                level = cell["level"]
                if level == NORMAL:
                    continue
                color     = config.COLOR_HIGH if level == HIGH_RISK else config.COLOR_MEDIUM
                thickness = 3 if level == HIGH_RISK else 2
                x0, y0 = c * cell_w, r * cell_h
                x1, y1 = x0 + cell_w, y0 + cell_h
                cv2.rectangle(frame, (x0, y0), (x1, y1), color, thickness)

                # Small block warning text
                label = "DANGER ZONE" if level == HIGH_RISK else "WARNING"
                (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                
                # Draw solid background for text
                cv2.rectangle(frame, (x0, y0), (x0 + label_w + 4, y0 + label_h + 4), color, -1)
                # Draw text in black
                cv2.putText(frame, label, (x0 + 2, y0 + label_h + 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
        return frame
