"""Shows the loop seam: the last two frames and the first two, side by side, in one PNG.
   python3 seam.py <framesDir> <out.png> [thumbWidth=360]"""
import sys, glob
from PIL import Image, ImageDraw
frames = sorted(glob.glob(sys.argv[1].rstrip('/') + '/*.png'))
tw = int(sys.argv[3]) if len(sys.argv) > 3 else 360
pick = [frames[-2], frames[-1], frames[0], frames[1]]
ims = [Image.open(p).convert('RGB') for p in pick]
th = round(ims[0].height * tw / ims[0].width)
sheet = Image.new('RGB', (tw * 4 + 40, th + 16), (40, 40, 40))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (8 + i * (tw + 8), 8))
ImageDraw.Draw(sheet).line([(8 + 2 * (tw + 8) - 4, 0), (8 + 2 * (tw + 8) - 4, th + 16)], fill=(255, 80, 80), width=2)
sheet.save(sys.argv[2]); print(sys.argv[2], sheet.size, '(red line = where the loop restarts)')
