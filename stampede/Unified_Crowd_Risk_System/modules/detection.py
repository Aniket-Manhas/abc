# =============================================================================
# modules/detection.py
# YOLOv8 person detector
# Adapted from: Crowd-Gathering-Detection/crowd_gathering.py
# =============================================================================

from ultralytics import YOLO
import config


class PersonDetector:
    """
    Wraps a YOLOv8 model and returns only 'person' (class 0) detections.

    Usage:
        detector = PersonDetector()
        boxes = detector.detect(frame)
        # boxes → list of (x1, y1, x2, y2, confidence)
    """

    def __init__(self):
        print(f"[Detection] Loading YOLO model: {config.YOLO_MODEL_PATH}")
        self.model = YOLO(config.YOLO_MODEL_PATH)
        print("[Detection] YOLO model loaded successfully.")

    def detect(self, frame):
        """
        Run inference on a single BGR frame.

        Returns
        -------
        list of (x1, y1, x2, y2, conf) — pixel coords in the original frame.
        """
        results = self.model.predict(
            frame,
            imgsz=config.YOLO_IMG_SIZE,
            conf=config.YOLO_CONF,
            classes=[0],        # Only detect persons
            verbose=False,
        )

        boxes = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                boxes.append((x1, y1, x2, y2, conf))
        return boxes
