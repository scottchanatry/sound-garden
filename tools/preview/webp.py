"""python3 webp.py <framesDir> <out.webp> [quality] [kmax]
Animated WebP, 720 x 900, 24 fps from 30 fps frames. Key frames at most every kmax frames so the lossy
encoder cannot leave a lingering ghost of something that faded out (e.g. a tap mark) for long."""
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
q = int(sys.argv[3]) if len(sys.argv) > 3 else 66
kmax = int(sys.argv[4]) if len(sys.argv) > 4 else 12
files = sorted(f for f in os.listdir(src) if f.startswith('c') and f.endswith('.png'))
n = len(files); m = int(n * 24 / 30)
frames = [Image.open(os.path.join(src, files[min(n - 1, round(i * 30 / 24))])).convert('RGB').resize((720, 900), Image.LANCZOS) for i in range(m)]
durs = [round((i + 1) * 1000 / 24) - round(i * 1000 / 24) for i in range(m)]
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=q, method=4,
               kmin=kmax - 1, kmax=kmax, allow_mixed=False, minimize_size=False)
print(out, m, 'frames', round(os.path.getsize(out) / 1e6, 2), 'MB')
