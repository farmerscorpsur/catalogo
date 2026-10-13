#!/usr/bin/env python3
"""
clean_edges.py — limpieza de bordes (halo) para las imágenes del catálogo Supply BA.

Problema: los PNG son recortes con alfa BINARIO (0 o 255) y el RGB de la zona
transparente quedó con el color del fondo (típicamente blanco). Al reducir o
componer, ese RGB se filtra hacia el borde y produce el halo blanco.

Solución:
  1) Descontaminar el color: propagar el RGB de los píxeles "sólidos" hacia la
     zona transparente con una convolución normalizada (gaussiana, sigma=SIGMA_COLOR).
  2) Erosionar ERODE_PX píxeles el alfa y luego suavizarlo con un blur leve
     (SIGMA_ALPHA) para un antialiasing limpio.

No se toca la resolución ni el nombre. Salida en OUT_DIR (PNG RGBA), espejando
la estructura de subcarpetas del origen.

Instalación de dependencias:
    pip install pillow numpy tqdm

Uso:
    python clean_edges.py
    python clean_edges.py --src Catalogo --out out
    python clean_edges.py --limit 5          # prueba rápida con 5 imágenes

Requiere correr desde la raíz del proyecto (donde está la carpeta Catalogo/).
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from tqdm import tqdm
from multiprocessing import Pool, cpu_count

# ========================= PARÁMETROS =========================
ERODE_PX     = 1      # erosión del alfa, en píxeles (1 = recomendado)
SIGMA_ALPHA  = 0.7    # sigma del blur del alfa (antialiasing)
SIGMA_COLOR  = 3.0    # sigma de propagación de color (descontaminación)
SOLID_T      = 128    # umbral de alfa para considerar un píxel "sólido"

SRC_DIR      = "Catalogo"   # carpeta con los PNG originales
OUT_DIR      = "out"        # carpeta de salida (se crea si no existe)
WORKERS      = None         # None = todos los núcleos disponibles
EXTS         = (".png",)    # extensiones a procesar
# ==============================================================


def gblur(arr, sigma):
    """Gaussian blur separable sobre un array float32 2D (implementación numpy)."""
    if sigma <= 0:
        return arr.astype(np.float32, copy=False)
    rad = max(1, int(round(3 * sigma)))
    x = np.arange(-rad, rad + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    h, w = arr.shape
    padded = np.pad(arr.astype(np.float32), ((0, 0), (rad, rad)), mode="edge")
    tmp = np.zeros((h, w), dtype=np.float32)
    for i, kv in enumerate(k):
        tmp += kv * padded[:, i:i + w]
    padded2 = np.pad(tmp, ((rad, rad), (0, 0)), mode="edge")
    out = np.zeros((h, w), dtype=np.float32)
    for i, kv in enumerate(k):
        out += kv * padded2[i:i + h, :]
    return out



def clean_edge(im):
    """Recibe una PIL.Image en RGBA y devuelve otra PIL.Image RGBA con el borde limpio."""
    arr = np.asarray(im, dtype=np.float32)          # (H, W, 4)
    rgb = arr[..., :3]
    a = arr[..., 3]

    # --- máscara de píxeles sólidos ---
    solid = (a >= SOLID_T).astype(np.float32)

    # --- descontaminación de color (convolución normalizada) ---
    den = gblur(solid, SIGMA_COLOR)
    den = np.where(den < 1e-6, 1.0, den)
    spread = np.empty_like(rgb)
    for c in range(3):
        num = gblur(rgb[..., c] * solid, SIGMA_COLOR)
        spread[..., c] = num / den

    rgb_out = np.where(solid[..., None] > 0, rgb, spread)

    # --- alfa: erosión + blur (antialiasing) ---
    if ERODE_PX > 0:
        size = 2 * ERODE_PX + 1                     # debe ser impar >= 3
        eroded = Image.fromarray(a.astype(np.uint8), "L").filter(ImageFilter.MinFilter(size))
        eroded = np.asarray(eroded, dtype=np.float32)
    else:
        eroded = a

    alpha = np.clip(gblur(eroded, SIGMA_ALPHA), 0, 255)

    out = np.dstack([np.clip(rgb_out, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def work(args):
    """Procesa una imagen. Devuelve ('ok'|'skip'|'err', relpath, [detalle])."""
    src, src_root, out_root = args
    rel = os.path.relpath(src, src_root)
    dst = os.path.join(out_root, rel)
    try:
        with Image.open(src) as im:
            im = im.convert("RGBA")
            alpha = np.asarray(im)[..., 3]
            # sin canal alfa útil o fondo blanco totalmente opaco -> no tocar
            if int(alpha.min()) == 255:
                return ("skip", rel, "")
            os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
            clean_edge(im).save(dst, "PNG")
        return ("ok", rel, "")
    except Exception as e:  # noqa: BLE001
        return ("err", rel, f"{type(e).__name__}: {e}")


def find_images(src_root):
    out = []
    for root, _dirs, files in os.walk(src_root):
        for f in files:
            if f.lower().endswith(EXTS):
                out.append(os.path.join(root, f))
    return sorted(out)


def main():
    src = SRC_DIR
    out = OUT_DIR
    limit = 0
    # permitir sobreescribir por CLI
    argv = sys.argv[1:]
    if "--src" in argv:
        src = argv[argv.index("--src") + 1]
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])

    if not os.path.isdir(src):
        print(f"ERROR: no existe la carpeta de origen '{src}'. Corré el script desde la raíz del proyecto.")
        return 1

    files = find_images(src)
    if limit:
        files = files[:limit]
    if not files:
        print(f"No se encontraron imágenes ({EXTS}) en '{src}'.")
        return 1

    os.makedirs(out, exist_ok=True)
    workers = WORKERS or os.cpu_count() or 1
    print(f"Imágenes: {len(files)}  ·  núcleos: {workers}  ·  salida: '{out}'")
    print(f"Params: erode={ERODE_PX}px  sigma_alpha={SIGMA_ALPHA}  sigma_color={SIGMA_COLOR}  t={SOLID_T}")

    tasks = [(f, src, out) for f in files]
    processed, skipped, errors = [], [], []

    with open(os.path.join(out, "_sin_transparencia.txt"), "w", encoding="utf-8") as fs, \
         open(os.path.join(out, "_fallidas.txt"), "w", encoding="utf-8") as fe:
        with Pool(workers) as pool:
            for status, rel, detail in tqdm(pool.imap_unordered(work, tasks, chunksize=8), total=len(tasks), unit="img"):
                if status == "ok":
                    processed.append(rel)
                elif status == "skip":
                    skipped.append(rel)
                    fs.write(rel + "\n")
                else:
                    errors.append((rel, detail))
                    fe.write(f"{rel}\t{detail}\n")

    print("\n================ RESUMEN ================")
    print(f"Procesadas OK ........: {len(processed)}")
    print(f"Sin transparencia ....: {len(skipped)}  -> {os.path.join(out, '_sin_transparencia.txt')}")
    print(f"Errores ..............: {len(errors)}  -> {os.path.join(out, '_fallidas.txt')}")
    if errors:
        print("Fallidas:")
        for rel, detail in errors[:50]:
            print(f"  - {rel}  ::  {detail}")
        if len(errors) > 50:
            print(f"  ... y {len(errors) - 50} más (ver _fallidas.txt)")
    print("=========================================")
    return 0


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    raise SystemExit(main())
