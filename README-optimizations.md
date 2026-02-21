# PersonaPlex 7B — Optimization Breakdown

Real-time full-duplex speech-to-speech AI, optimized from 141ms to 78.3ms per frame on Jetson Thor. Cross-validated on DGX Spark (74.2ms).

## Performance

| Metric | Jetson Thor | DGX Spark |
|--------|-------------|-----------|
| Total frame time | **78.3ms** | **74.2ms** |
| LM step | 70.2ms | ~70ms |
| Mimi encode | 3.5ms | ~3ms |
| Mimi decode | 3.2ms | ~3ms |
| GPU memory | 9.99 GB | ~10 GB |
| Frame budget | 80ms | 80ms |

**Progression on Jetson Thor**: 141ms (baseline) → 101ms (FP8) → 88.9ms (skip dead code) → 78.3ms (MAXN + system tuning)

## Optimizations Applied

### Working (in production)
1. **FP8 dynamic quantization** — `torch._scaled_mm` monkey-patch on F.linear. 321 Linear + 32 in_proj_weight quantized. Saved **40ms** (114→74ms lm_step).
2. **Skip other_mimi** — encode/decode results always discarded. Saved **9.6ms**.
3. **Mimi FP16 + torch.compile** — `.half()` + `torch.compile(mimi)`. Saved **3ms** on encode/decode.
4. **MAXN + jetson_clocks + CPU pin** — GPU 5x, EMC 1.55x, taskset cores 4-13. Saved **9ms** (Jetson Thor only).
5. **Pinned memory DtoH** — Pre-allocated pinned buffer for audio output. Saved **0.7ms**.
6. **Audio buffering** — 0.5s client-side buffer absorbs frame variance.
7. **Context=3000** — Upstream default, 240s conversation window. Stable.

### Tried & Failed
- **FP8 KV cache** — SDPA/flash-attn reject FP8 inputs (PyTorch 2.9.1, flash-attn 2.8.3)
- **FP8 depformer attention** — Per-step matrices too small ([3072,1024]), quant overhead cancels savings
- **NVFP4** — 5.8-10.6x slower than FP8 (no FP4 Tensor Core support, dequant→FP16 GEMM)
- **TensorRT FP16** — 16% slower than FP8 at batch=1 (reads 2x the data)
- **CUDA stream overlap** — cuDNN + torch.compile fails on non-default streams
- **KV context=750** — Garbled after 60s (ring buffer wrap), reverted to 3000

## Theoretical Limits

### Jetson Thor (200 GB/s LPDDR5X)
```
Weight-read floor (FP8): 6.6 GB / 200 GB/s = 33.0ms
KV cache floor (bf16):   1.5 GB / 200 GB/s =  7.5ms
Combined floor:          40.5ms
Current lm_step:         70.2ms (1.73x floor)
Gap:                     ~30ms
```

### DGX Spark (273 GB/s LPDDR5X)
```
Weight-read floor (FP8): 6.6 GB / 273 GB/s = 24.2ms
KV cache floor (bf16):   1.5 GB / 273 GB/s =  5.5ms
Combined floor:          29.7ms
Current lm_step:         ~70ms (2.36x floor)
Gap:                     ~40ms
```

The gap is CUDA graph replay overhead, Python dispatch, and the depformer's small-matrix operations that can't be efficiently quantized. The lm_step is nearly identical on both platforms (~70ms) despite different memory bandwidths — confirming that the bottleneck at FP8 has shifted from bandwidth to overhead.

## Platform Requirements

- **Blackwell GPU** (SM >= 12.0) — FP8 Tensor Core support required
- Jetson Thor: JetPack 7.1, L4T R38.4.0
- DGX Spark: CUDA 13.0, PyTorch with cu130
- Both: Python 3.12, libopus, Rust (for sphn)

FP8 does NOT work on Ampere (Jetson AGX Orin, sm_87) or older. The bf16 baseline (141ms) exceeds the 80ms frame budget even at theoretical minimum on Orin.
