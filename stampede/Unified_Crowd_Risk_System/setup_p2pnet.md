# P2PNet setup (required for dense crowd counting)

The pipeline expects the official Tencent P2PNet repository and weights.

```bash
cd stampede/Unified_Crowd_Risk_System
git clone https://github.com/TencentYoutuResearch/CrowdCounting-P2PNet.git
```

Download `SHTechA.pth` from the [P2PNet releases / README](https://github.com/TencentYoutuResearch/CrowdCounting-P2PNet) into:

`CrowdCounting-P2PNet/weights/SHTechA.pth`

Optional: set environment variable if the repo lives elsewhere:

```bash
set P2PNET_DIR=C:\path\to\CrowdCounting-P2PNet
```

## Test dense crowd image

```bash
python test_dense_crowd.py path\to\stadium.jpg --sweep
```

Outputs go to `debug_p2pnet/` including side-by-side OLD (640px) vs FIXED (full + tiled) counts.
