#!/usr/bin/env python3
"""
Correccion fotografica CONSERVADORA para la foto provisional del doctor.

Solo ajusta luz, balance de color, ruido y encuadre. NO retoca el rostro,
no suaviza la piel, no cambia rasgos ni usa IA generativa.

Uso:
  python3 tools/enhance_photo.py <entrada.jpg> <salida.jpg>
"""
import sys

import cv2
import numpy as np


def enhance(src_path: str, dst_path: str) -> None:
    img = cv2.imread(src_path)
    if img is None:
        raise SystemExit(f"No se pudo leer {src_path}")
    h, w = img.shape[:2]

    # 1) Encuadre vertical 9:10 centrado en el sujeto (proporcional al tamano original).
    cx = int(w * 0.50)
    crop_w = int(w * 0.70)
    crop_h = int(crop_w * 10 / 9)
    x0 = max(0, min(w - crop_w, cx - crop_w // 2))
    y0 = max(0, min(h - crop_h, int(h * 0.06)))
    img = img[y0 : y0 + crop_h, x0 : x0 + crop_w]

    # 2) Reduccion de ruido suave (la foto tiene ruido de poca luz).
    img = cv2.fastNlMeansDenoisingColored(img, None, 2, 2, 7, 21)

    # 3) Luz: elevar sombras con curva gamma y recuperar contraste local con CLAHE suave.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0] / 255.0
    L = np.power(L, 0.86)  # eleva medios y sombras con suavidad
    L8 = np.clip(L * 255.0, 0, 255).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(4, 4))
    L8 = clahe.apply(L8)
    lab[:, :, 0] = L8.astype(np.float32)

    # 4) Color: la iluminacion calida del local amarillea la imagen. Se corrige parcialmente
    #    (no por completo, para conservar un tono de piel natural y calido).
    a = lab[:, :, 1]
    b = lab[:, :, 2]
    lab[:, :, 1] = np.clip(a - (a.mean() - 128.0) * 0.35, 0, 255)
    lab[:, :, 2] = np.clip(b - (b.mean() - 128.0) * 0.35, 0, 255)

    img = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

    # 5) Nitidez sutil.
    blur = cv2.GaussianBlur(img, (0, 0), 1.2)
    img = cv2.addWeighted(img, 1.12, blur, -0.12, 0)

    cv2.imwrite(dst_path, img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"OK {dst_path} {img.shape[1]}x{img.shape[0]}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    enhance(sys.argv[1], sys.argv[2])
