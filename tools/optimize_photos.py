"""Non-generative photo optimisation for property photos.

Only global/local tonal and colour corrections — nothing is added, removed or
re-drawn, so architecture and furnishings stay exactly as photographed.

Steps per image:
  1. gentle white balance (grey-world, blended, gains clamped)
  2. local shadow lift / highlight compression on a blurred luminance map
     (brightens dark interiors without flattening the whole frame)
  3. mild S-curve for depth
  4. vibrance (boosts muted colours more than already saturated ones)
  5. light unsharp mask for crispness

Usage: python3 optimize_photos.py <input_dir> <output_dir>
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def white_balance(img: np.ndarray, strength: float = 0.3) -> np.ndarray:
    # Ignore near-black and clipped pixels so sky/sun don't dominate the estimate.
    lum = img @ LUMA
    mask = (lum > 0.08) & (lum < 0.92)
    means = img[mask].mean(axis=0) if mask.any() else img.reshape(-1, 3).mean(axis=0)
    gains = means.mean() / np.maximum(means, 1e-4)
    gains = 1 + strength * (gains - 1)
    gains = np.clip(gains, 0.92, 1.1)
    # Keep a slightly warm, inviting tone instead of a clinically neutral one.
    gains = gains * np.array([1.025, 1.0, 0.965], dtype=np.float32)
    return np.clip(img * gains, 0, 1)


def local_tone(img: np.ndarray, pil_size: tuple[int, int]) -> np.ndarray:
    lum = img @ LUMA
    radius = max(pil_size) / 40
    blurred = np.asarray(
        Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)),
        dtype=np.float32,
    ) / 255.0
    # Exposure: lift overall towards a mid-grey key, but only modestly.
    key = float(np.exp(np.log(lum + 1e-3).mean()))
    exposure = np.clip((0.45 / max(key, 1e-3)) ** 0.4, 1.0, 1.4)
    # Shadows: up to +55 % in the darkest regions, fading out by mid-tones.
    shadow_gain = 1 + 0.55 * np.clip((0.45 - blurred) / 0.45, 0, 1) ** 1.5
    # Highlights: compress bright areas (windows, sky) a little.
    highlight_gain = 1 - 0.12 * np.clip((blurred - 0.8) / 0.2, 0, 1)
    gain = exposure * shadow_gain * highlight_gain
    return np.clip(img * gain[..., None], 0, 1)


def s_curve(img: np.ndarray, amount: float = 0.12) -> np.ndarray:
    # Smooth contrast curve anchored at 0, 0.5 and 1.
    return np.clip(img - amount * np.sin(2 * np.pi * img) / (2 * np.pi), 0, 1)


def vibrance(img: np.ndarray, amount: float = 0.28) -> np.ndarray:
    lum = (img @ LUMA)[..., None]
    sat = img.max(axis=2, keepdims=True) - img.min(axis=2, keepdims=True)
    boost = 1 + amount * (1 - np.clip(sat / 0.6, 0, 1))
    return np.clip(lum + (img - lum) * boost, 0, 1)


def optimise(path: Path, out_dir: Path) -> Path:
    pil = Image.open(path).convert("RGB")
    img = np.asarray(pil, dtype=np.float32) / 255.0
    img = white_balance(img)
    img = local_tone(img, pil.size)
    img = s_curve(img)
    img = vibrance(img)
    out = Image.fromarray((img * 255 + 0.5).astype(np.uint8))
    out = out.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))
    target = out_dir / f"{path.stem}.jpg"
    out.save(target, "JPEG", quality=92, subsampling=0, optimize=True)
    return target


def main() -> None:
    in_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(
        (p for p in in_dir.iterdir() if p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}),
        key=lambda p: (len(p.stem), p.stem),
    )
    for p in files:
        print(optimise(p, out_dir))


if __name__ == "__main__":
    main()
