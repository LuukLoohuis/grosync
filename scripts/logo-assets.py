"""
Makes every logo file the app uses from the master logo, docs/logo/couplecart-logo.webp
(emblem, "CoupleCart" wordmark and the slogan, on a transparent background).

  python3 scripts/logo-assets.py

Needs Pillow. Writes:
  src/assets/couplecart-logo.webp         the whole logo, for the login screen
  src/assets/couplecart-logo-donker.webp  the same with light letters, for the dark theme
  public/favicon.png                      only the emblem, square; also the icon in the app's header
  public/og-image.png                     the whole logo on cream, for link previews
"""
from PIL import Image

SOURCE = 'docs/logo/couplecart-logo.webp'
CREAM = (0xF4, 0xF2, 0xEA)
# In the dark theme "Couple" becomes a lighter green and the slogan the theme's own ink (#F0EEE4).
DARK_WORDMARK = (0x6E, 0xB4, 0x5A)
DARK_SLOGAN = (0xF0, 0xEE, 0xE4)


def empty_rows(image):
    """Bands of fully transparent rows, as (first, last)."""
    alpha = image.getchannel('A')
    bands, start = [], None
    for y in range(image.height):
        empty = alpha.crop((0, y, image.width, y + 1)).getbbox() is None
        if empty and start is None:
            start = y
        elif not empty and start is not None:
            bands.append((start, y - 1))
            start = None
    return bands


def fit(image, width, height, background=None):
    """`image` scaled to fit width × height, centred, on `background` or transparent."""
    scale = min(width / image.width, height / image.height)
    scaled = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (width, height), background + (255,) if background else (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((width - scaled.width) // 2, (height - scaled.height) // 2))
    return canvas


source = Image.open(SOURCE).convert('RGBA')
# The master has near-invisible pixels (alpha 1) around it; without them the crop is tight.
source.putalpha(source.getchannel('A').point(lambda v: 0 if v <= 8 else v))
logo = source.crop(source.getchannel('A').getbbox())

# Top to bottom: emblem, gap, wordmark, gap, slogan.
(emblem_end, wordmark_start), (wordmark_end, slogan_start) = [(a - 1, b + 1) for a, b in empty_rows(logo)[:2]]
emblem = logo.crop((0, 0, logo.width, emblem_end + 1))
emblem = emblem.crop(emblem.getchannel('A').getbbox())

dark = logo.copy()
pixels = dark.load()
for y in range(wordmark_start, logo.height):
    colour = DARK_WORDMARK if y < slogan_start else DARK_SLOGAN
    for x in range(logo.width):
        r, g, b, a = pixels[x, y]
        # Green and black ink only; the red "Cart" stays as it is.
        if a and g >= r:
            pixels[x, y] = colour + (a,)

LOGO_WIDTH = 768  # three times the 256 px it is shown at
logo_height = round(logo.height * LOGO_WIDTH / logo.width)
for image, path in ((logo, 'src/assets/couplecart-logo.webp'), (dark, 'src/assets/couplecart-logo-donker.webp')):
    image.resize((LOGO_WIDTH, logo_height), Image.LANCZOS).save(path, 'WEBP', quality=90, alpha_quality=100, method=6)
    print(path, LOGO_WIDTH, logo_height)

square = fit(emblem, 480, 480)
favicon = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
favicon.alpha_composite(square, (16, 16))
favicon.save('public/favicon.png', optimize=True)
print('public/favicon.png 512 512')

og = fit(logo, 1200, 530, CREAM)
preview = Image.new('RGBA', (1200, 630), CREAM + (255,))
preview.alpha_composite(og, (0, 50))
preview.convert('RGB').save('public/og-image.png', optimize=True)
print('public/og-image.png 1200 630')
print('logo', logo.size, 'emblem', emblem.size, 'wordmark rows', wordmark_start, wordmark_end, 'slogan from', slogan_start)
