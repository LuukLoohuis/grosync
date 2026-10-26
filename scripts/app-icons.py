"""
Makes the home-screen icons from the app icon, docs/logo/couplecart-app-icon.webp: the emblem on a
cream tile with rounded corners, which lies on a light background with a drop shadow.

  python3 scripts/app-icons.py

Needs Pillow and numpy. The phone rounds the corners itself and iOS paints transparent pixels black,
so every icon is a full square of tile: its surface is continued up to the edges, without the
background, the shadow and the tile's own rim. Writes:
  public/apple-touch-icon.png          180 px, what iPhone and iPad put on the home screen
  public/icons/icon-192.png, -512.png  the same picture, for the manifest
  public/icons/icon-maskable-512.png   the emblem smaller, because Android may crop it to a circle
  public/icons/favicon-512.png         the browser-tab icon: the tile with its own rounded corners,
  public/favicon.ico                   transparent outside them; the .ico holds 16 to 256 px
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = 'docs/logo/couplecart-app-icon.webp'
# The tile in the 1254 px source, measured by hand: its box (left, top, right, bottom) and the
# radius of its corners. Another picture needs new numbers.
SOURCE_SIZE = (1254, 1254)
TILE = (94, 94, 1158, 1140)
RADIUS = 275
# Near its edge the tile has a light rim at the top and darkens, most of all at the bottom. Up to
# EDGE px inside the edge the fitted surface replaces it; over the next BLEND px the source takes
# over gradually, so no line shows. The emblem always stays as it is (it keeps 48 px from the edge).
EDGE = 24
BLEND = 56
# The surface is fitted on the tile from this far inside the edge, past the darker border.
FIT_DEPTH = 60
# Android keeps a maskable icon's middle circle of 80% at least; the emblem stays inside 76%.
SAFE_RADIUS = 0.38
PAD = 200

source = Image.open(SOURCE).convert('RGB')
if source.size != SOURCE_SIZE:
    sys.exit(f'{SOURCE} is {source.size[0]} x {source.size[1]} px: measure TILE and RADIUS for it first')
pixels = np.asarray(source, dtype=np.float64)
height, width, _ = pixels.shape
left, top, right, bottom = TILE
cx, cy, hx, hy = (left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2


def depth_and_core(x, y):
    """How far (x, y) lies inside the tile's edge (negative outside it, at most RADIUS), and the
    nearest point of the rectangle that becomes the tile when its edge is pushed out by RADIUS."""
    core_x = np.clip(x, left + RADIUS, right - RADIUS)
    core_y = np.clip(y, top + RADIUS, bottom - RADIUS)
    return RADIUS - np.hypot(x - core_x, y - core_y), core_x, core_y


def surface_terms(x, y):
    """A smooth curved surface in x and y (a polynomial of degree 3) for the tile's light and colour."""
    u, v = (x - cx) / hx, (y - cy) / hy
    return [u ** i * v ** j for i in range(4) for j in range(4 - i)]


def surface_at(coefficients, x, y):
    """The fitted surface, held at its value on the fitted area for points outside it."""
    depth, core_x, core_y = depth_and_core(x, y)
    scale = np.where(depth < FIT_DEPTH, (RADIUS - FIT_DEPTH) / np.maximum(RADIUS - depth, 1e-9), 1)
    x, y = core_x + (x - core_x) * scale, core_y + (y - core_y) * scale
    result = np.zeros(x.shape + (3,))
    for term, coefficient in zip(surface_terms(x, y), coefficients):
        result += term[..., None] * coefficient
    return result


ys, xs = np.mgrid[0:height, 0:width].astype(np.float64)
depth, _, _ = depth_and_core(xs, ys)

# Fit the surface on the tile's cream, leaving out the emblem: start from all light, nearly grey
# pixels and drop whatever lies more than 6 off the fit.
cream = (depth >= FIT_DEPTH) & (pixels.min(axis=2) > 190) & (np.ptp(pixels, axis=2) < 32)
samples = cream
for _ in range(4):
    sample_ys, sample_xs = np.nonzero(samples[::2, ::2])
    sample_xs, sample_ys = sample_xs * 2.0, sample_ys * 2.0
    terms = np.stack(surface_terms(sample_xs, sample_ys), axis=1)
    coefficients = np.linalg.lstsq(terms, pixels[sample_ys.astype(int), sample_xs.astype(int)], rcond=None)[0]
    surface = surface_at(coefficients, xs, ys)
    off = np.abs(pixels - surface).max(axis=2)
    samples = cream & (off < 6)
print(f'surface fitted on {samples.sum()} px, {off[samples].mean():.1f} off on average')

# The emblem: everything clearly off the surface, away from the rim. It is always kept as it is.
emblem = (off > 12) & (depth > 40)
emblem_ys, emblem_xs = np.nonzero(emblem)
centre_x = (emblem_xs.min() + emblem_xs.max()) / 2
centre_y = (emblem_ys.min() + emblem_ys.max()) / 2
reach = np.hypot(emblem_xs - centre_x, emblem_ys - centre_y).max()
print(f'emblem {emblem_xs.min()}-{emblem_xs.max()} x {emblem_ys.min()}-{emblem_ys.max()}, '
      f'{depth[emblem].min():.0f} px from the edge at least, reaches {reach:.0f} px from its centre')
emblem = Image.fromarray(emblem.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
blend = np.clip((depth - EDGE) / BLEND, 0, 1)
keep = np.maximum(blend * blend * (3 - 2 * blend), np.asarray(emblem, dtype=np.float64) / 255)

# The tile, continued for PAD px on every side, so a crop may reach past the source.
canvas_ys, canvas_xs = np.mgrid[-PAD:height + PAD, -PAD:width + PAD].astype(np.float64)
canvas = surface_at(coefficients, canvas_xs, canvas_ys)
inside = canvas[PAD:PAD + height, PAD:PAD + width]
inside[:] = keep[..., None] * pixels + (1 - keep[..., None]) * inside
canvas = Image.fromarray(np.clip(np.rint(canvas), 0, 255).astype(np.uint8))


def write(path, size, side):
    """A square of `side` source pixels round the emblem's centre, as a size × size PNG."""
    x, y = centre_x + PAD - side / 2, centre_y + PAD - side / 2
    canvas.resize((size, size), Image.LANCZOS, box=(x, y, x + side, y + side)).save(path, optimize=True)
    print(f'{path} {size} x {size}')


# The tile's own size: the emblem fills the icon as it fills the tile.
tile_side = max(right - left, bottom - top)
write('public/apple-touch-icon.png', 180, tile_side)
write('public/icons/icon-192.png', 192, tile_side)
write('public/icons/icon-512.png', 512, tile_side)
write('public/icons/icon-maskable-512.png', 512, reach / SAFE_RADIUS)

# The browser tab shows no tile of its own, so the favicon gets the tile's rounded corners, drawn at
# four times the size for smooth edges. The emblem's centre is not the tile's, so the crop is the
# tile's box itself, made square.
x = cx + PAD - tile_side / 2
y = cy + PAD - tile_side / 2
tile = canvas.resize((512, 512), Image.LANCZOS, box=(x, y, x + tile_side, y + tile_side)).convert('RGBA')
corners = Image.new('L', (2048, 2048), 0)
ImageDraw.Draw(corners).rounded_rectangle((0, 0, 2047, 2047), radius=round(RADIUS * 2048 / tile_side), fill=255)
tile.putalpha(corners.resize((512, 512), Image.LANCZOS))
tile.save('public/icons/favicon-512.png', optimize=True)
tile.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('public/icons/favicon-512.png 512 x 512, public/favicon.ico 16-256')
