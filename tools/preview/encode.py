"""Encodes composed frames into the three delivery formats and prints their sizes.

   python3 encode.py <framesDir> <outPrefix> --fps 30 [--gif-fps 15] [--gif-width 480] [--gif-colors 128]
                     [--webp-fps 20] [--webp-width 720] [--webp-q 72] [--mp4-width 720] [--crf 22] [--pattern c%04d.png]

   Writes <outPrefix>.gif (for a GitHub README), <outPrefix>.webp (animated, for the web page) and
   <outPrefix>.mp4. All loop forever. Widths are in real pixels; height follows the aspect ratio."""
import argparse, os, subprocess, sys

p = argparse.ArgumentParser()
p.add_argument('frames'); p.add_argument('out')
p.add_argument('--fps', type=float, default=30)
p.add_argument('--pattern', default='c%04d.png')
p.add_argument('--gif-fps', type=float, default=15); p.add_argument('--gif-width', type=int, default=480); p.add_argument('--gif-colors', type=int, default=128)
p.add_argument('--webp-fps', type=float, default=20); p.add_argument('--webp-width', type=int, default=720); p.add_argument('--webp-q', type=int, default=72)
p.add_argument('--mp4-width', type=int, default=720); p.add_argument('--crf', type=int, default=22)
a = p.parse_args()
src = ['-framerate', str(a.fps), '-i', os.path.join(a.frames, a.pattern)]

def run(args):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode: sys.exit('ffmpeg failed: ' + r.stderr[-800:])

def even(w): return w - (w % 2)

run(src + ['-vf', f"fps={a.gif_fps},scale={even(a.gif_width)}:-2:flags=lanczos,split[x][y];[x]palettegen=max_colors={a.gif_colors}:stats_mode=diff[p];[y][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
           '-loop', '0', a.out + '.gif'])
run(src + ['-vf', f"fps={a.webp_fps},scale={even(a.webp_width)}:-2:flags=lanczos", '-c:v', 'libwebp_anim', '-lossless', '0',
           '-q:v', str(a.webp_q), '-compression_level', '6', '-loop', '0', a.out + '.webp'])
run(src + ['-vf', f"scale={even(a.mp4_width)}:-2:flags=lanczos", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', str(a.crf),
           '-preset', 'slow', '-movflags', '+faststart', '-an', a.out + '.mp4'])
for ext in ('gif', 'webp', 'mp4'):
    f = f'{a.out}.{ext}'
    print(f'{f}: {os.path.getsize(f) / 1e6:.2f} MB')
