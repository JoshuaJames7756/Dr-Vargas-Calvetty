#!/usr/bin/env python3
"""Convierte el logo sobre fondo blanco en PNG con transparencia (color a alfa) y genera iconos."""
import sys
import cv2
import numpy as np

src, out_dir = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_COLOR).astype(np.float32)  # BGR
rgb = img[:, :, ::-1]
lo = rgb.min(axis=2)
alpha = np.clip((255.0 - lo) / 255.0, 0, 1)
alpha = np.clip(alpha / 0.945, 0, 1)  # el teal mas oscuro del logo queda 100% opaco
alpha = np.where(alpha < 0.02, 0, alpha)
safe = np.maximum(alpha, 1e-3)[..., None]
col = 255.0 - (255.0 - rgb) / safe
col = np.clip(col, 0, 255)
out = np.dstack([col[:, :, ::-1], (alpha * 255)[..., None]]).astype(np.uint8)  # BGRA

ys, xs = np.where(out[:, :, 3] > 8)
pad = 12
y0, y1 = max(0, ys.min() - pad), min(out.shape[0], ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(out.shape[1], xs.max() + pad)
crop = out[y0:y1, x0:x1]
cv2.imwrite(f"{out_dir}/logo.png", crop)

# Icono cuadrado con margen para favicon y app icon.
h, w = crop.shape[:2]
side = int(max(h, w) * 1.18)
sq = np.zeros((side, side, 4), np.uint8)
oy, ox = (side - h) // 2, (side - w) // 2
sq[oy:oy + h, ox:ox + w] = crop
for size in (32, 180, 512):
    cv2.imwrite(f"{out_dir}/icon-{size}.png", cv2.resize(sq, (size, size), interpolation=cv2.INTER_AREA))
print("OK", crop.shape)
