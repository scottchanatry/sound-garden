"""Makes a contact sheet (one PNG) from evenly spaced frames, so an animation can be reviewed as a still.
   python3 sheet.py <framesDir> <out.png> [count=8] [thumbWidth=220]"""
import sys, glob
from PIL import Image
frames = sorted(glob.glob(sys.argv[1].rstrip('/') + '/*.png'))
out = sys.argv[2]
count = int(sys.argv[3]) if len(sys.argv) > 3 else 8
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 220
pick = [frames[round(i * (len(frames) - 1) / (count - 1))] for i in range(count)]
ims = [Image.open(p).convert('RGB') for p in pick]
th = round(ims[0].height * tw / ims[0].width)
sheet = Image.new('RGB', (tw * count + 8 * (count + 1), th + 16), (40, 40, 40))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (8 + i * (tw + 8), 8))
sheet.save(out)
print(out, sheet.size, 'frames used:', [p.split('/')[-1] for p in pick])
