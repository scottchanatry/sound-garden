"""Turns a frame sequence into a seamless loop, and can move the loop's starting point.

   python3 loop.py <inDir> <outDir> [--pattern c%04d.png] [--crossfade N] [--rotate K]

   --crossfade N  The input has N extra frames at the end beyond the loop length. They are blended over
                  the first N frames, so the jump from the last frame back to the first is hidden.
                  Output has (input frames - N) frames.
   --rotate K     Start the loop K frames later (frames wrap around). Use this so the first frame of
                  the loop is a good-looking one. Only meaningful once the loop is seamless."""
import argparse, glob, os, re
from PIL import Image
p = argparse.ArgumentParser(); p.add_argument('src'); p.add_argument('dst')
p.add_argument('--pattern', default='c%04d.png'); p.add_argument('--crossfade', type=int, default=0); p.add_argument('--rotate', type=int, default=0)
a = p.parse_args()
rx = re.compile('^' + re.sub(r'%0?\d*d', r'\\d+', re.escape(a.pattern).replace('\\%', '%')) + '$')
files = sorted(f for f in os.listdir(a.src) if rx.match(f))
n = len(files) - a.crossfade
assert n > a.crossfade >= 0, 'not enough frames for that crossfade'
os.makedirs(a.dst, exist_ok=True)
for f in os.listdir(a.dst):
    if rx.match(f): os.remove(os.path.join(a.dst, f))
out = []
for i in range(n):
    im = Image.open(os.path.join(a.src, files[i])).convert('RGB')
    if i < a.crossfade:
        tail = Image.open(os.path.join(a.src, files[n + i])).convert('RGB')
        im = Image.blend(tail, im, (i + 1) / (a.crossfade + 1))
    out.append(im)
k = a.rotate % n
out = out[k:] + out[:k]
for i, im in enumerate(out):
    im.save(os.path.join(a.dst, a.pattern % i))
print(f'{a.dst}: {n} frames (crossfade {a.crossfade}, rotate {k})')
