#!/usr/bin/env python3
"""
test_dense_crowd.py — Debug P2PNet on a single dense-crowd image.

Usage:
  cd stampede/Unified_Crowd_Risk_System
  python test_dense_crowd.py path/to/crowd.jpg
  python test_dense_crowd.py path/to/crowd.jpg --threshold 0.25 --no-tiling
  python test_dense_crowd.py path/to/crowd.jpg --sweep

Requires CrowdCounting-P2PNet cloned and SHTechA.pth in weights/.
  git clone https://github.com/TencentYoutuResearch/CrowdCounting-P2PNet.git
  # download weights/SHTechA.pth into that repo
  set P2PNET_DIR=C:\\path\\to\\CrowdCounting-P2PNet  (optional)
"""

from __future__ import annotations

import argparse
import os
import sys

import cv2

# Ensure project root on path
_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import config
from modules.detection import PersonDetector
from modules.p2pnet_counter import P2PNetCounter, get_load_status


def main():
    parser = argparse.ArgumentParser(description="Debug dense crowd counting (YOLO vs P2PNet)")
    parser.add_argument("image", help="Path to crowd image (jpg/png)")
    parser.add_argument("--threshold", type=float, default=None, help="P2PNet score threshold")
    parser.add_argument("--no-tiling", action="store_true", help="Disable tiled inference")
    parser.add_argument("--sweep", action="store_true", help="Run threshold sweep 0.5→0.05")
    parser.add_argument("--out-dir", default=os.path.join(_ROOT, "debug_p2pnet"), help="Output folder")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"ERROR: Image not found: {args.image}")
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(args.image))[0]

    frame = cv2.imread(args.image)
    if frame is None:
        print(f"ERROR: Could not read image: {args.image}")
        sys.exit(1)

    h, w = frame.shape[:2]
    print("=" * 60)
    print("DENSE CROWD DEBUG")
    print("=" * 60)
    print(f"Image:        {args.image}")
    print(f"Original size: {w} x {h}")
    print(f"P2PNET_DIR:   {config.P2PNET_DIR}")
    print(f"Weights:      {config.P2PNET_WEIGHTS}")
    print(f"Tiling:       {config.P2PNET_USE_TILING and not args.no_tiling} (tile={config.P2PNET_TILE_SIZE})")
    print(f"DENSE_THRESHOLD (YOLO→P2P switch): {config.DENSE_THRESHOLD}")
    print()

    status = get_load_status()
    print("Model load status:", status)
    print()

    # ── YOLO on downscaled preview (old broken path) ─────────────────────────
    scale = min(1.0, config.PROCESS_WIDTH / w) if w > config.PROCESS_WIDTH else 1.0
    small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale < 1.0 else frame
    print(f"YOLO preview size (PROCESS_WIDTH={config.PROCESS_WIDTH}): {small.shape[1]}x{small.shape[0]}")

    detector = PersonDetector()
    yolo_boxes_small = detector.detect(small)
    yolo_boxes_full = detector.detect(frame)
    print(f"YOLO count @ {small.shape[1]}px wide: {len(yolo_boxes_small)}")
    print(f"YOLO count @ full resolution:      {len(yolo_boxes_full)}")
    print(f"→ P2PNet would activate (>= {config.DENSE_THRESHOLD}): "
          f"{len(yolo_boxes_small) >= config.DENSE_THRESHOLD}")
    print()

    counter = P2PNetCounter()
    if not counter.available:
        print("ERROR: P2PNet not loaded. Fix P2PNET_DIR / weights and retry.")
        print("  git clone https://github.com/TencentYoutuResearch/CrowdCounting-P2PNet.git")
        print(f"  Place at: {config.P2PNET_DIR}")
        sys.exit(2)

    # Save resized preview (what OLD pipeline fed to P2PNet)
    preview_path = os.path.join(args.out_dir, f"{base}_preview_{small.shape[1]}w.jpg")
    cv2.imwrite(preview_path, small)
    print(f"Saved YOLO/P2P-old preview: {preview_path}")

    if args.sweep:
        print("\n--- Threshold sweep (full frame, tiled) ---")
        sweep = counter.sweep_thresholds(frame)
        for t, info in sorted(sweep.items(), reverse=True):
            print(f"  thresh={t:.2f}  count={info['count']:6d}  "
                  f"raw={info.get('above_threshold', '?')}  mode={info.get('inference_mode', '?')}")

    force_tiling = False if args.no_tiling else None
    points, count, debug = counter.count(
        frame,
        threshold=args.threshold,
        force_tiling=force_tiling,
        return_debug=True,
    )

    print("\n--- P2PNet result (FIXED pipeline: full frame + tiling) ---")
    for k, v in debug.items():
        print(f"  {k}: {v}")

    out_vis = os.path.join(args.out_dir, f"{base}_p2pnet_count_{count}.jpg")
    counter.visualize(frame, points=points, out_path=out_vis)

    # Compare: P2PNet on tiny preview (reproduces ~21 bug)
    pts_old, cnt_old, dbg_old = counter.count(small, return_debug=True)
    out_old = os.path.join(args.out_dir, f"{base}_OLD_preview_only_{cnt_old}.jpg")
    counter.visualize(small, points=pts_old, out_path=out_old)
    print(f"\n--- OLD broken path (P2PNet on {small.shape[1]}px preview) ---")
    print(f"  count={cnt_old}  (this is why you saw ~21 on stadium images)")
    print(f"  saved: {out_old}")

    print(f"\nFinal count (fixed): {count}")
    print(f"Visualization:     {out_vis}")
    print("=" * 60)


if __name__ == "__main__":
    main()
