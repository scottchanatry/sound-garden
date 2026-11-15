"""Draws the app icons: the wild rose of the empty garden, on cream paper.

The flower is the one src/botany.js draws for note 6, set down again here from
the same numbers so that the icons need nothing but Pillow. Keep the two in step.
Run with: npm run icons  (python3 scripts/make-icons.py)"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"

# The colours of src/theme.js. LEAF and BLUSH are notes 3 and 6 of NOTE_COLORS in src/garden.js.
PAPER = (253, 251, 243)
INK = (31, 61, 46)
SAGE = (127, 162, 131)
LEAF = (154, 206, 159)
BLUSH = (239, 187, 169)
BUTTER = (240, 210, 124)
WHITE = (255, 255, 255)

BOX = 64  # the flower is drawn on a square this many units across
MIDDLE = BOX / 2
POSE = -18  # it sits turned this many degrees, as it does in the empty garden
SMOOTH = 4  # draw this many times too large, then shrink, for smooth edges
STEPS = 20  # straight pieces to each curve


def lie(angle, length=1.0, bend=0.0):
    """Turns a distance along and across a shape that grows from the middle into a point."""
    turn = math.radians(angle + POSE)
    sin, cos = math.sin(turn), math.cos(turn)

    def at(along, across=0.0):
        aside = across + bend * along * along / length
        return (MIDDLE + along * sin + aside * cos, MIDDLE - along * cos + aside * sin)

    return at


def curve(points):
    """The points along a curve steered by two, three or four points."""
    line = []
    for step in range(STEPS + 1):
        t = step / STEPS
        hull = points
        while len(hull) > 1:
            hull = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in zip(hull, hull[1:])]
        line.append(hull[0])
    return line


def mirrored(at, edge):
    """A closed shape, the same on both sides of its middle line, from one side of it."""
    out = [(along, -across) for along, across in edge]
    back = list(reversed([(0, 0)] + edge[:-1]))
    points = [at(0, 0)] + [at(along, across) for along, across in out + back]
    shape = []
    for i in range(0, len(points) - 1, 3):
        shape += curve(points[i:i + 4])[:-1]
    return shape


def leaf(at, length, width):
    reach = width / 2 * 4 / 3
    return mirrored(at, [(length * 0.3, reach), (length * 0.62, reach * 0.9), (length, 0)])


def lobed(at, length, width, dip):
    half = width / 2
    return mirrored(at, [
        (length * 0.16, half * 0.3), (length * 0.4, half), (length * 0.66, half),
        (length * 0.86, half), (length, half * 0.86), (length, half * 0.5),
        (length, half * 0.22), (length * (1 - dip * 0.4), half * 0.08), (length * (1 - dip), 0),
    ])


def rib(at, length, start=0.2, end=0.76):
    return curve([at(length * start), at(length * (start + end) / 2), at(length * end)])


def dot(at, along, radius):
    cx, cy = at(along)
    return [(cx + radius * math.cos(math.tau * i / 48), cy + radius * math.sin(math.tau * i / 48)) for i in range(48)]


SLIPS = [0.3, -0.85, 0.65, -0.2, 1, -0.6, 0.1, -1, 0.8, -0.4, 0.5, -0.75, 0.9]


def slip(n):
    return SLIPS[n % len(SLIPS)]


def whorl(count, turn, length, hand):
    """Places for shapes set round the middle: (lie, length, lean) for each."""
    places = []
    for i in range(count):
        angle = turn + i * 360 / count + 4 * slip(hand + i)
        reach = length * (1 + 0.07 * slip(hand + 2 * i + 4))
        lean = slip(hand + 3 * i + 7)
        places.append((lie(angle, reach, 0.1 * lean), reach, lean))
    return places


# The wild rose, as in wildRose() in src/botany.js.
LEAVES = whorl(3, 38, 27.5, 4)
PETALS = whorl(5, 2, 21.5, 0)
ANTHERS = whorl(7, 14, 7.6, 8)
HEART = dot(lie(0), 0, 5)
RIB, CREASE = 0.85, 0.35  # a rib is this much of the outline's weight; a crease is as fine, and this faint


class Sheet:
    """A square of paper `size` pixels across with the flower's box filling `box` pixels of its middle."""

    def __init__(self, size, box, line):
        self.size = size
        self.scale = box * SMOOTH / BOX
        self.shift = (size - box) * SMOOTH / 2
        self.line = line * self.scale
        self.image = Image.new("RGBA", (size * SMOOTH, size * SMOOTH), (0, 0, 0, 0))

    def spots(self, points):
        return [(x * self.scale + self.shift, y * self.scale + self.shift) for x, y in points]

    def stroke(self, draw, points, ink, weight=1.0):
        """A line with round ends and corners: each straight piece, then a disc on every point."""
        width = max(1, round(self.line * weight))
        draw.line(points, fill=ink, width=width)
        for x, y in points:
            draw.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=ink)

    def paint(self, shape, fill, ink=INK + (255,)):
        """A tinted shape with an ink outline."""
        points = self.spots(shape)
        draw = ImageDraw.Draw(self.image)
        draw.polygon(points, fill=fill + (255,))
        self.stroke(draw, points + points[:2], ink)

    def ink(self, lines, weight=RIB, opacity=1.0):
        """Fine ink lines, all at one strength even where they cross."""
        mask = Image.new("L", self.image.size, 0)
        draw = ImageDraw.Draw(mask)
        for line in lines:
            self.stroke(draw, self.spots(line), round(255 * opacity), weight)
        layer = Image.new("RGBA", self.image.size, INK + (0,))
        layer.putalpha(mask)
        self.image.alpha_composite(layer)

    def dots(self, shapes, fill=INK + (255,)):
        draw = ImageDraw.Draw(self.image)
        for shape in shapes:
            draw.polygon(self.spots(shape), fill=fill)

    def rings(self, rings):
        """Hairline growth rings round the middle: (radius, opacity) for each, as a share of the paper."""
        middle = self.size * SMOOTH / 2
        for radius, opacity in rings:
            r = radius * self.size * SMOOTH
            layer = Image.new("RGBA", self.image.size, SAGE + (0,))
            ImageDraw.Draw(layer).ellipse(
                [middle - r, middle - r, middle + r, middle + r],
                outline=SAGE + (round(255 * opacity),),
                width=round(self.size * SMOOTH * 0.007),
            )
            self.image.alpha_composite(layer)

    def shrunk(self):
        return self.image.resize((self.size, self.size), Image.LANCZOS)


def blossom(size, box, line, paper=None, rings=()):
    """The flower in full colour. `line` is the weight of its outline, in the flower's own units."""
    sheet = Sheet(size, box, line)
    if paper:
        sheet.image.paste(paper + (255,), (0, 0) + sheet.image.size)
    sheet.rings(rings)
    for at, length, _ in LEAVES:
        sheet.paint(leaf(at, length, 10), LEAF)
    sheet.ink([rib(at, length) for at, length, _ in LEAVES])
    for at, length, _ in PETALS:
        sheet.paint(lobed(at, length, 18, 0.08), BLUSH)
    creases = [rib(at, length, 0.34, 0.58) for at, length, _ in PETALS]
    threads = [[at(5), at(length)] for at, length, _ in ANTHERS]
    sheet.ink(creases + threads, opacity=CREASE)
    sheet.paint(HEART, BUTTER)
    sheet.dots([dot(at, length, 0.8 * (1 + 0.1 * lean)) for at, length, lean in ANTHERS])
    return sheet.shrunk()


def silhouette(size, box, line):
    """The flower alone, flat white with its outlines cut out of it, for Android's themed icons."""
    sheet = Sheet(size, box, line)
    clear = (0, 0, 0, 0)
    for at, length, _ in PETALS:
        sheet.paint(lobed(at, length, 18, 0.08), WHITE, clear)
    sheet.paint(HEART, WHITE, clear)
    sheet.dots([dot(at, length, 1) for at, length, _ in ANTHERS], clear)
    return sheet.shrunk()


RINGS = [(0.41, 0.8), (0.47, 0.4)]

blossom(1024, 800, 1.05, PAPER, RINGS).convert("RGB").save(OUT / "icon.png")
blossom(1024, 1040, 0.75).save(OUT / "splash-icon.png")
blossom(48, 47, 1.7).save(OUT / "favicon.png")
# Android adaptive icon: the art stays inside the centre 62 percent, which no mask cuts into.
blossom(1024, 610, 1.05).save(OUT / "android-icon-foreground.png")
Image.new("RGB", (1024, 1024), PAPER).save(OUT / "android-icon-background.png")
silhouette(1024, 610, 1.8).save(OUT / "android-icon-monochrome.png")
print("Wrote icons to", OUT)
