"""Draws the app icons: a dot with ripples spreading from it, on night blue.
Run with: python3 scripts/make-icons.py  (needs Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets"
NIGHT = (11, 16, 32)
RINGS = [(126, 231, 196), (120, 190, 255), (196, 160, 255)]
SCALE = 2  # draw large, then shrink, for smooth edges


def art(size, background, colors=RINGS, dot=(255, 236, 170), reach=0.40, glow=True):
    big = size * SCALE
    image = Image.new("RGBA", (big, big), background)
    centre = big / 2
    if glow:
        halo = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        r = big * 0.2
        ImageDraw.Draw(halo).ellipse([centre - r, centre - r, centre + r, centre + r], fill=dot + (120,))
        image.alpha_composite(halo.filter(ImageFilter.GaussianBlur(big * 0.06)))
    draw = ImageDraw.Draw(image)
    for index, color in enumerate(colors):
        r = big * reach * (index + 1) / len(colors)
        width = max(2, int(big * 0.022 * (1 - index * 0.22)))
        alpha = int(255 * (1 - index * 0.25))
        draw.ellipse([centre - r, centre - r, centre + r, centre + r], outline=color + (alpha,), width=width)
    r = big * 0.055
    draw.ellipse([centre - r, centre - r, centre + r, centre + r], fill=dot + (255,))
    return image.resize((size, size), Image.LANCZOS)


art(1024, NIGHT + (255,)).convert("RGB").save(OUT / "icon.png")
art(1024, NIGHT + (255,), reach=0.26).convert("RGB").save(OUT / "splash-icon.png")
art(48, NIGHT + (255,)).convert("RGB").save(OUT / "favicon.png")
# Android adaptive icon: art stays inside the centre safe zone.
art(1024, (0, 0, 0, 0), reach=0.27).save(OUT / "android-icon-foreground.png")
Image.new("RGB", (1024, 1024), NIGHT).save(OUT / "android-icon-background.png")
white = (255, 255, 255)
art(1024, (0, 0, 0, 0), colors=[white] * 3, dot=white, reach=0.27, glow=False).save(OUT / "android-icon-monochrome.png")
print("Wrote icons to", OUT)
