"""Builds the PWA / home-screen icons from assets/icon-source.webp (the green ₹ tile).

Run with `npm run icons` (needs Pillow: `pip install pillow`).
  - "any" icons keep the tile's rounded shape on a transparent background.
  - "maskable" and Apple icons are full-bleed: the tile sits on its own green, so the
    launcher's circle/squircle mask never shows a white or black edge.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / 'assets' / 'icon-source.webp').convert('RGBA')

# Trim to the tile (ignore the faint soft shadow).
tile = src.crop(src.getchannel('A').point(lambda a: 255 if a > 200 else 0).getbbox())
GREEN = tile.getpixel((tile.width // 12, tile.height // 2))[:3]


def square(img: Image.Image, size: int, fill=None, scale=1.0) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (*fill, 255) if fill else (0, 0, 0, 0))
    s = size * scale / max(img.size)
    w, h = round(img.width * s), round(img.height * s)
    canvas.alpha_composite(img.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


def out(rel: str, img: Image.Image):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print('wrote', rel)


out('public/icons/icon-192.png', square(tile, 192, scale=0.96))
out('public/icons/icon-512.png', square(tile, 512, scale=0.96))
# Maskable: the ₹ must stay inside the central 80% safe zone.
out('public/icons/maskable-512.png', square(tile, 512, fill=GREEN, scale=0.88))
out('public/icons/maskable-192.png', square(tile, 192, fill=GREEN, scale=0.88))
out('app/apple-icon.png', square(tile, 180, fill=GREEN, scale=1.0).convert('RGB'))
out('app/icon.png', square(tile, 64, scale=1.0))
