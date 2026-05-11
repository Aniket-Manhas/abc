# =============================================================================
# modules/p2pnet_counter.py
# P2PNet wrapper for dense crowd counting from video frames.
# Loads the CrowdCounting-P2PNet model and provides a simple inference API.
# Falls back gracefully if PyTorch/weights are unavailable.
# =============================================================================

import os
import sys
import threading
import numpy as np
import cv2

import config

# ── Load P2PNet from sibling directory ────────────────────────────────────────
_p2pnet_available = False
_model            = None
_device           = None
_transform        = None
_load_lock        = threading.Lock()
_load_attempted   = False


def _load_p2pnet():
    """Try to load P2PNet model once. Thread-safe."""
    global _p2pnet_available, _model, _device, _transform, _load_attempted
    _load_attempted = True

    try:
        if not os.path.isdir(config.P2PNET_DIR):
            print(f"[P2PNet] Directory not found: {config.P2PNET_DIR}")
            return
        if not os.path.exists(config.P2PNET_WEIGHTS):
            print(f"[P2PNet] Weights not found: {config.P2PNET_WEIGHTS}")
            return

        if config.P2PNET_DIR not in sys.path:
            sys.path.insert(0, config.P2PNET_DIR)

        import torch
        import torchvision.transforms as T
        from PIL import Image  # noqa — ensure PIL available

        # Import P2PNet build function (requires sys.path set above)
        from models import build_model  # type: ignore

        import argparse
        args = argparse.Namespace(backbone='vgg16_bn', row=2, line=2)

        _device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"[P2PNet] Loading model on {_device}…")

        model = build_model(args, training=False)
        checkpoint = torch.load(config.P2PNET_WEIGHTS, map_location='cpu')
        model.load_state_dict(checkpoint['model'])
        model.eval()
        model.to(_device)

        _transform = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        _model            = model
        _p2pnet_available = True
        print("[P2PNet] Model loaded successfully ✓")

    except Exception as exc:
        print(f"[P2PNet] Load failed — YOLO-only mode. Reason: {exc}")
        _p2pnet_available = False


class P2PNetCounter:
    """
    Wraps P2PNet for dense crowd counting from video frames.

    Usage
    -----
    counter = P2PNetCounter()
    points, count = counter.count(bgr_frame)
    # points → list of (x, y)  head locations in original-frame pixels
    # count  → int number of persons
    """

    def __init__(self):
        if not config.P2PNET_ENABLED:
            return
        with _load_lock:
            if not _load_attempted:
                _load_p2pnet()

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def available(self):
        return _p2pnet_available

    def count(self, frame, threshold=None):
        """
        Run P2PNet inference on a BGR frame.

        Parameters
        ----------
        frame     : np.ndarray — BGR video frame
        threshold : float      — score threshold (default: config.P2PNET_THRESHOLD)

        Returns
        -------
        points : list of (x, y) — person head locations
        count  : int            — number of persons
        """
        if not _p2pnet_available or _model is None:
            return [], 0

        thresh = threshold if threshold is not None else config.P2PNET_THRESHOLD

        try:
            import torch
            from PIL import Image

            orig_h, orig_w = frame.shape[:2]

            # BGR → RGB PIL image
            rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)

            # P2PNet requires dimensions that are multiples of 128
            new_w = max(128, orig_w // 128 * 128)
            new_h = max(128, orig_h // 128 * 128)
            pil_img = pil_img.resize((new_w, new_h), Image.BILINEAR)

            img_tensor = _transform(pil_img).unsqueeze(0).to(_device)

            with torch.no_grad():
                outputs = _model(img_tensor)

            scores   = torch.nn.functional.softmax(
                outputs['pred_logits'], -1)[:, :, 1][0]
            pts_raw  = outputs['pred_points'][0]

            mask     = scores > thresh
            pts_list = pts_raw[mask].detach().cpu().numpy().tolist()

            # Scale coordinates back to original frame size
            sx = orig_w / new_w
            sy = orig_h / new_h
            points = [(int(p[0] * sx), int(p[1] * sy)) for p in pts_list]

            return points, len(points)

        except Exception as exc:
            print(f"[P2PNet] Inference error: {exc}")
            return [], 0
