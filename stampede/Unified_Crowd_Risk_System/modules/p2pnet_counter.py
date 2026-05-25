# =============================================================================
# modules/p2pnet_counter.py — P2PNet dense crowd counting (production pipeline)
#
# Root causes fixed (vs. old ~21 counts on 5k+ crowds):
#   1. P2PNet was run on 640px YOLO process frames → heads too small to detect
#   2. No tiled inference on 4K stadium images → single downscale loses detail
#   3. Threshold / coordinate handling not validated against official run_test.py
# =============================================================================

from __future__ import annotations

import os
import sys
import threading
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np

import config

_p2pnet_available = False
_model = None
_device = None
_transform = None
_load_lock = threading.Lock()
_load_attempted = False
_load_info: dict = {}


def _log(msg: str) -> None:
    print(msg)
    if config.P2PNET_DEBUG:
        print(f"[P2PNet:debug] {msg}")


def _round_dim(n: int) -> int:
    """P2PNet expects H,W divisible by 128 (official run_test.py)."""
    return max(128, int(n) // 128 * 128)


def _resize_pil(pil_img, target_w: int, target_h: int):
    from PIL import Image
    resample = getattr(Image, "Resampling", Image).LANCZOS
    return pil_img.resize((target_w, target_h), resample)


@dataclass
class InferenceDebug:
    """Collected during count() for test_dense_crowd.py and P2PNET_DEBUG."""

    original_size: Tuple[int, int] = (0, 0)
    inference_mode: str = ""
    tiles: int = 0
    scales: List[float] = field(default_factory=list)
    raw_proposals: int = 0
    above_threshold: int = 0
    after_merge: int = 0
    threshold: float = 0.0
    score_min: float = 0.0
    score_max: float = 0.0
    score_mean: float = 0.0
    per_threshold_counts: dict = field(default_factory=dict)

    def as_dict(self):
        return {
            "original_size": self.original_size,
            "inference_mode": self.inference_mode,
            "tiles": self.tiles,
            "scales": self.scales,
            "raw_proposals": self.raw_proposals,
            "above_threshold": self.above_threshold,
            "after_merge": self.after_merge,
            "threshold": self.threshold,
            "score_min": round(self.score_min, 4),
            "score_max": round(self.score_max, 4),
            "score_mean": round(self.score_mean, 4),
            "per_threshold_counts": self.per_threshold_counts,
        }


def _ensure_vgg_backbone_weights() -> None:
    """Download ImageNet VGG backbone weights expected by P2PNet's vgg_.py."""
    import urllib.request

    ckpt_dir = os.path.join(config.P2PNET_DIR, "checkpoints")
    os.makedirs(ckpt_dir, exist_ok=True)
    files = {
        "vgg16_bn-6c64b313.pth": "https://download.pytorch.org/models/vgg16_bn-6c64b313.pth",
        "vgg16-397923af.pth": "https://download.pytorch.org/models/vgg16-397923af.pth",
    }
    for name, url in files.items():
        dest = os.path.join(ckpt_dir, name)
        if os.path.isfile(dest) and os.path.getsize(dest) > 1_000_000:
            continue
        _log(f"[P2PNet] Downloading backbone weights: {name}")
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception as exc:
            _log(f"[P2PNet] Failed to download {name}: {exc}")

def _ensure_p2pnet_weights() -> None:
    """Download P2PNet SHTechA.pth weights if P2PNET_WEIGHTS_URL is provided."""
    import urllib.request

    if os.path.isfile(config.P2PNET_WEIGHTS) and os.path.getsize(config.P2PNET_WEIGHTS) > 1_000_000:
        return
        
    url = os.environ.get("P2PNET_WEIGHTS_URL")
    if not url:
        return
        
    os.makedirs(os.path.dirname(config.P2PNET_WEIGHTS), exist_ok=True)
    _log(f"[P2PNet] Downloading P2PNet weights from {url}")
    try:
        urllib.request.urlretrieve(url, config.P2PNET_WEIGHTS)
    except Exception as exc:
        _log(f"[P2PNet] Failed to download weights: {exc}")


def _patch_torchvision_compat() -> None:
    """P2PNet repo uses torchvision.ops._new_empty_tensor removed in newer torchvision."""
    try:
        import torch
        import torchvision.ops as tv_ops
        if not hasattr(tv_ops, "_new_empty_tensor"):
            def _new_empty_tensor(input_tensor, shape):
                return torch.empty(shape, dtype=input_tensor.dtype, device=input_tensor.device)

            tv_ops._new_empty_tensor = _new_empty_tensor
            _log("[P2PNet] Patched torchvision.ops._new_empty_tensor for compatibility")
    except Exception as exc:
        _log(f"[P2PNet] torchvision compat patch skipped: {exc}")


def _load_p2pnet() -> None:
    global _p2pnet_available, _model, _device, _transform, _load_attempted, _load_info
    _load_attempted = True
    _load_info = {"dir": config.P2PNET_DIR, "weights": config.P2PNET_WEIGHTS}

    try:
        if not os.path.isdir(config.P2PNET_DIR):
            _log(f"[P2PNet] Directory not found: {config.P2PNET_DIR}")
            _log("[P2PNet] Clone: git clone https://github.com/TencentYoutuResearch/CrowdCounting-P2PNet.git")
            _log(f"[P2PNet] Then set P2PNET_DIR or place repo at: {config.P2PNET_DIR}")
            return
        if not os.path.isfile(config.P2PNET_WEIGHTS):
            _log(f"[P2PNet] Weights not found: {config.P2PNET_WEIGHTS}")
            _log("[P2PNet] Download SHTechA.pth into CrowdCounting-P2PNet/weights/")
            return

        if config.P2PNET_DIR not in sys.path:
            sys.path.insert(0, config.P2PNET_DIR)

        _patch_torchvision_compat()
        _ensure_vgg_backbone_weights()
        _ensure_p2pnet_weights()

        import torch
        import torchvision.transforms as T
        from models import build_model  # type: ignore
        import argparse

        args = argparse.Namespace(backbone="vgg16_bn", row=2, line=2)
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        _log(f"[P2PNet] Loading checkpoint: {config.P2PNET_WEIGHTS}")
        _log(f"[P2PNet] Device: {_device}")

        model = build_model(args, training=False)
        checkpoint = torch.load(config.P2PNET_WEIGHTS, map_location="cpu")

        if "model" not in checkpoint:
            _log("[P2PNet] Checkpoint missing 'model' key — wrong file?")
            return

        state = checkpoint["model"]
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing:
            _log(f"[P2PNet] Missing keys ({len(missing)}): {missing[:5]}...")
        if unexpected:
            _log(f"[P2PNet] Unexpected keys ({len(unexpected)}): {unexpected[:5]}...")

        param_count = sum(p.numel() for p in model.parameters())
        _log(f"[P2PNet] Parameters: {param_count:,}")
        _log(f"[P2PNet] Architecture: VGG16-bn backbone, row={args.row}, line={args.line}")

        model.eval()
        model.to(_device)

        _transform = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        _model = model
        _p2pnet_available = True
        _load_info.update({
            "loaded": True,
            "params": param_count,
            "missing_keys": len(missing),
            "unexpected_keys": len(unexpected),
        })
        _log("[P2PNet] Model loaded successfully")

    except Exception as exc:
        _log(f"[P2PNet] Load failed: {exc}")
        _p2pnet_available = False
        _load_info["error"] = str(exc)


def _nms_points(
    points: List[Tuple[int, int]],
    scores: List[float],
    min_dist: float,
) -> List[Tuple[int, int]]:
    if len(points) <= 1:
        return points
    order = sorted(range(len(points)), key=lambda i: -scores[i])
    kept: List[Tuple[int, int]] = []
    kept_scores: List[float] = []
    d2 = min_dist * min_dist
    for i in order:
        px, py = points[i]
        ok = True
        for kx, ky in kept:
            if (px - kx) ** 2 + (py - ky) ** 2 < d2:
                ok = False
                break
        if ok:
            kept.append((px, py))
            kept_scores.append(scores[i])
    return kept


def _infer_on_rgb_pil(pil_img, threshold: float) -> Tuple[List[Tuple[int, int]], List[float], dict]:
    """
    Run P2PNet on a PIL RGB image (already resized to 128-multiple dimensions).
    Returns points in *pil_img* pixel coordinates (official run_test.py behaviour).
    """
    import torch
    from PIL import Image

    if _model is None or _transform is None:
        return [], [], {}

    w, h = pil_img.size
    tensor = _transform(pil_img).unsqueeze(0).to(_device)

    with torch.no_grad():
        outputs = _model(tensor)

    scores_t = torch.nn.functional.softmax(outputs["pred_logits"], dim=-1)[:, :, 1][0]
    pts_t = outputs["pred_points"][0]

    scores_np = scores_t.detach().cpu().numpy()
    pts_np = pts_t.detach().cpu().numpy()

    stats = {
        "proposals": int(len(scores_np)),
        "score_min": float(scores_np.min()) if len(scores_np) else 0.0,
        "score_max": float(scores_np.max()) if len(scores_np) else 0.0,
        "score_mean": float(scores_np.mean()) if len(scores_np) else 0.0,
        "inference_size": (w, h),
    }

    mask = scores_np > threshold
    pts_f = pts_np[mask]
    scores_f = scores_np[mask].tolist()

    points = [(int(round(p[0])), int(round(p[1]))) for p in pts_f]
    return points, scores_f, stats


def _scale_points_to_orig(
    points: List[Tuple[int, int]],
    scores: List[float],
    from_wh: Tuple[int, int],
    to_wh: Tuple[int, int],
) -> Tuple[List[Tuple[int, int]], List[float]]:
    fw, fh = from_wh
    tw, th = to_wh
    if fw == tw and fh == th:
        return points, scores
    sx, sy = tw / max(fw, 1), th / max(fh, 1)
    scaled = [(int(round(x * sx)), int(round(y * sy))) for x, y in points]
    return scaled, scores


def _count_single_pass(
    bgr_tile: np.ndarray,
    threshold: float,
    scale: float = 1.0,
) -> Tuple[List[Tuple[int, int]], List[float], dict]:
    """One forward pass on a BGR tile (optionally scaled)."""
    from PIL import Image

    if scale != 1.0:
        h, w = bgr_tile.shape[:2]
        nw, nh = int(w * scale), int(h * scale)
        bgr_tile = cv2.resize(bgr_tile, (nw, nh), interpolation=cv2.INTER_LINEAR)

    orig_h, orig_w = bgr_tile.shape[:2]
    rgb = cv2.cvtColor(bgr_tile, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)

    inf_w, inf_h = _round_dim(orig_w), _round_dim(orig_h)
    pil_inf = _resize_pil(pil, inf_w, inf_h)

    pts, scores, st = _infer_on_rgb_pil(pil_inf, threshold)
    pts, scores = _scale_points_to_orig(pts, scores, (inf_w, inf_h), (orig_w, orig_h))
    st["scale"] = scale
    st["tile_input_size"] = (orig_w, orig_h)
    st["inference_resized"] = (inf_w, inf_h)
    return pts, scores, st


def _count_tiled(bgr: np.ndarray, threshold: float, debug: InferenceDebug) -> Tuple[List[Tuple[int, int]], List[float]]:
    h, w = bgr.shape[:2]
    tile = config.P2PNET_TILE_SIZE
    overlap = config.P2PNET_TILE_OVERLAP
    stride = max(128, tile - overlap)

    all_pts: List[Tuple[int, int]] = []
    all_scores: List[float] = []
    raw_proposals = 0
    tile_count = 0

    for y0 in range(0, h, stride):
        for x0 in range(0, w, stride):
            y1 = min(y0 + tile, h)
            x1 = min(x0 + tile, w)
            if y1 - y0 < 128 or x1 - x0 < 128:
                continue
            tile_img = bgr[y0:y1, x0:x1]
            tile_count += 1
            for scale in config.P2PNET_MULTISCALE:
                pts, scores, st = _count_single_pass(tile_img, threshold, scale=scale)
                raw_proposals += st.get("proposals", 0)
                for (px, py), sc in zip(pts, scores):
                    all_pts.append((px + x0, py + y0))
                    all_scores.append(sc)

    debug.tiles = tile_count
    debug.raw_proposals = raw_proposals
    return all_pts, all_scores


def _count_full_frame(bgr: np.ndarray, threshold: float, debug: InferenceDebug) -> Tuple[List[Tuple[int, int]], List[float]]:
    h, w = bgr.shape[:2]
    max_edge = max(h, w)

    if max_edge > config.P2PNET_MAX_SINGLE_EDGE:
        scale = config.P2PNET_MAX_SINGLE_EDGE / max_edge
        nw, nh = int(w * scale), int(h * scale)
        bgr = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LINEAR)
        _log(f"[P2PNet] Capped frame {w}x{h} → {nw}x{nh} for single-pass (use tiling for best results)")

    all_pts: List[Tuple[int, int]] = []
    all_scores: List[float] = []
    raw_proposals = 0

    for scale in config.P2PNET_MULTISCALE:
        pts, scores, st = _count_single_pass(bgr, threshold, scale=scale)
        raw_proposals += st.get("proposals", 0)
        all_pts.extend(pts)
        all_scores.extend(scores)

    debug.raw_proposals = raw_proposals
    return all_pts, all_scores


class P2PNetCounter:
    """
    Dense crowd counting via Tencent P2PNet (SHTech Part-A weights).

    Always pass the **full-resolution** BGR frame — not the 640px YOLO preview.
    """

    def __init__(self):
        self.last_debug: Optional[InferenceDebug] = None
        if not config.P2PNET_ENABLED:
            return
        with _load_lock:
            if not _load_attempted:
                _load_p2pnet()

    @property
    def available(self) -> bool:
        return _p2pnet_available

    @property
    def load_info(self) -> dict:
        return dict(_load_info)

    def count(
        self,
        frame: np.ndarray,
        threshold: Optional[float] = None,
        *,
        force_tiling: Optional[bool] = None,
        return_debug: bool = False,
    ):
        """
        Parameters
        ----------
        frame : BGR uint8, full resolution
        threshold : confidence cutoff on softmax(person) — default config.P2PNET_THRESHOLD

        Returns
        -------
        points, count  or  (points, count, debug_dict) if return_debug=True
        """
        dbg = InferenceDebug()
        self.last_debug = dbg

        if not _p2pnet_available or _model is None:
            empty = ([], 0)
            return (*empty, dbg.as_dict()) if return_debug else empty

        thresh = threshold if threshold is not None else config.P2PNET_THRESHOLD
        dbg.threshold = thresh

        orig_h, orig_w = frame.shape[:2]
        dbg.original_size = (orig_w, orig_h)

        use_tiling = (
            force_tiling
            if force_tiling is not None
            else (
                config.P2PNET_USE_TILING
                and max(orig_h, orig_w) > config.P2PNET_TILE_MIN_EDGE
            )
        )

        if use_tiling:
            dbg.inference_mode = "tiled"
            dbg.scales = list(config.P2PNET_MULTISCALE)
            pts, scores = _count_tiled(frame, thresh, dbg)
        else:
            dbg.inference_mode = "single"
            dbg.scales = list(config.P2PNET_MULTISCALE)
            pts, scores = _count_full_frame(frame, thresh, dbg)

        dbg.above_threshold = len(pts)

        if scores:
            dbg.score_min = min(scores)
            dbg.score_max = max(scores)
            dbg.score_mean = sum(scores) / len(scores)

        merged = _nms_points(pts, scores, config.P2PNET_MERGE_DIST)
        dbg.after_merge = len(merged)

        if config.P2PNET_DEBUG:
            _log(
                f"[P2PNet] {dbg.inference_mode} {orig_w}x{orig_h} "
                f"proposals≈{dbg.raw_proposals} thresh={thresh} "
                f"raw={dbg.above_threshold} merged={dbg.after_merge}"
            )

        result = (merged, len(merged))
        return (*result, dbg.as_dict()) if return_debug else result

    def sweep_thresholds(
        self,
        frame: np.ndarray,
        thresholds: Tuple[float, ...] = (0.5, 0.3, 0.25, 0.1, 0.05),
    ) -> dict:
        """Run inference once per threshold (for debugging undercounting)."""
        out = {}
        for t in thresholds:
            _, cnt, d = self.count(frame, threshold=t, return_debug=True)
            out[t] = {"count": cnt, **d}
        if self.last_debug:
            self.last_debug.per_threshold_counts = {str(k): v["count"] for k, v in out.items()}
        return out

    def visualize(
        self,
        frame: np.ndarray,
        points: Optional[List[Tuple[int, int]]] = None,
        threshold: Optional[float] = None,
        out_path: Optional[str] = None,
    ) -> np.ndarray:
        """Draw detections on frame; optionally save to out_path."""
        if points is None:
            points, _ = self.count(frame, threshold=threshold)

        vis = frame.copy()
        for x, y in points:
            cv2.circle(vis, (x, y), 3, (0, 0, 255), -1)
            cv2.circle(vis, (x, y), 5, (0, 255, 255), 1)

        if self.last_debug:
            d = self.last_debug
            lines = [
                f"mode={d.inference_mode} count={d.after_merge}",
                f"size={d.original_size} thresh={d.threshold}",
                f"raw={d.above_threshold} proposals~{d.raw_proposals}",
            ]
            for i, line in enumerate(lines):
                cv2.putText(
                    vis, line, (12, 28 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA,
                )

        if out_path:
            os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
            cv2.imwrite(out_path, vis)
            _log(f"[P2PNet] Saved visualization: {out_path}")

        return vis


def get_load_status() -> dict:
    """For health endpoints / debugging."""
    return {
        "available": _p2pnet_available,
        **_load_info,
    }
