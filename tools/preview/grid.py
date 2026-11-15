"""Contact sheet in a grid, with the time of each frame written on it.
   python3 grid.py <framesDir> <out.png> <cols> <thumbWidth> <fps> <t0> <t1> <step> [offset]
   Frames at times t0, t0+step, ... < t1 (seconds from the first frame in the folder). offset is added to the label."""
import sys, glob
from PIL import Image, ImageDraw, ImageFont
d, out, cols, tw, fps, t0, t1, step = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), float(sys.argv[7]), float(sys.argv[8])
off = float(sys.argv[9]) if len(sys.argv) > 9 else 0.0
frames = sorted(glob.glob(d.rstrip('/') + '/*.png'))
times = []
t = t0
while t < t1 - 1e-9:
    times.append(t); t += step
idx = [min(len(frames) - 1, round(t * fps)) for t in times]
ims = [Image.open(frames[i]).convert('RGB') for i in idx]
th = round(ims[0].height * tw / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 6) + 6), (40, 40, 40))
try:
    font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 15)
except OSError:
    font = ImageFont.load_default()
dr = ImageDraw.Draw(sheet)
for n, im in enumerate(ims):
    x, y = 6 + (n % cols) * (tw + 6), 6 + (n // cols) * (th + 6)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    label = f'{times[n] + off:.2f}s #{idx[n]}'
    dr.rectangle([x, y, x + 8 * len(label) + 6, y + 19], fill=(255, 255, 255))
    dr.text((x + 3, y + 1), label, fill=(160, 30, 30), font=font)
sheet.save(out); print(out, sheet.size, len(ims), 'frames')
