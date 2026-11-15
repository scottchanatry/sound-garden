#!/bin/bash
# Sound Garden preview ("Plate", final). Records the real app from a web build and writes all six files.
#
#   bash make.sh <webBuildDir> <outDir> [port]
#
# port: a free port for the recording (default 8961). Takes about 15 minutes, most of it recording.
# Uses only the files in this folder. Working files (raw app frames, composed frames, the loop, contact
# sheets) go to $WORK_DIR/<name of outDir>/, by default under /tmp/sound-garden-preview.
# Make the web build first, from the repository root: npx expo export --platform web
#
# Writes into <outDir>:
#   sound-garden.webp  animated loop 720 x 900, 24 fps        (blog post)
#   sound-garden.gif   animated loop 480 x 600, 15 fps        (GitHub README)
#   sound-garden.mp4   the loop, 720 x 900, 30 fps, H.264 yuv420p
#   sound-garden.jpg   static version 1080 x 1350 (= loop frame 0, caption "Ripples wake the neighbours", no tap mark)
#   share.jpg          1200 x 630 link-preview card (the same app frame)
#   screenshot.png     780 x 1688 raw app frame: nine plants, rings in flight
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KIT="$HERE"
[ $# -ge 2 ] || { echo "usage: bash make.sh <webBuildDir> <outDir> [port]"; exit 2; }
WEB="$(cd "$1" && pwd)"
mkdir -p "$2"; OUT="$(cd "$2" && pwd)"
PORT="${3:-8961}"
WORK="${WORK_DIR:-${TMPDIR:-/tmp}/sound-garden-preview}/$(basename "$OUT")"
mkdir -p "$WORK"

# Fixed frame numbers (raw frame index = story seconds after a Clear, minus 1.4, times 30).
LOOPLEN=486     # 16.2 s at 30 fps; must match LOOP in make_score.py
CROSSFADE=12    # must match CROSSFADE in make_score.py
ROTATE=401      # loop frame 0 = raw frame 401: the wake run just finished, every plant ringing (story 14.77 s)
STILL=401       # the static picture and the share card use this raw frame
SHOT=147        # screenshot.png: nine plants (daisy just planted, daffodil not yet), rings in flight (story 6.3 s)

echo "== score"
python3 "$HERE/make_score.py" "$WORK/score.json" --port "$PORT" --build "$WEB"
python3 - "$WORK/score.json" <<'EOF'
import json, sys
p = sys.argv[1]; s = json.load(open(p))
s['stillCaption'] = 2; s['noTouches'] = True          # caption 'Ripples wake the neighbours', no finger mark
json.dump(s, open(p.replace('score.json', 'score-still.json'), 'w'), indent=1)
EOF

TOTAL=$((LOOPLEN + CROSSFADE))
if [ "${REUSE_RAW:-0}" = 1 ] && [ "$(ls "$WORK/raw" 2>/dev/null | grep -c '^f[0-9]*\.png$')" = $TOTAL ]; then
  echo "== REUSE_RAW=1: using the frames already recorded in $WORK/raw"
else
  echo "== record the app ($WEB, port $PORT) - the slow part, about 10 minutes"
  (cd "$KIT" && node capture.js "$WORK/score.json" "$WORK/raw")
fi
N=$(ls "$WORK/raw" | grep -c '^f[0-9]*\.png$')
[ "$N" = $TOTAL ] || { echo "expected $TOTAL raw frames, got $N"; exit 1; }

echo "== compose the page (3 workers)"
rm -rf "$WORK/composed" "$WORK"/part*; mkdir -p "$WORK/composed"
PARTS=3; CHUNK=$(( (TOTAL + PARTS - 1) / PARTS ))
for p in $(seq 0 $((PARTS - 1))); do
  A=$((p * CHUNK)); B=$(( (p + 1) * CHUNK - 1 )); [ $B -lt $TOTAL ] || B=$((TOTAL - 1))
  (cd "$KIT" && node compose.js "$HERE/scene.html" "$WORK/score.json" "$WORK/raw" "$WORK/part$p" 1080 1350 1 $A $B) &
done
wait
python3 - "$WORK" $PARTS $CHUNK <<'EOF'
import os, sys
w, parts, chunk = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
for p in range(parts):
    for f in sorted(os.listdir(f'{w}/part{p}')):
        os.rename(f'{w}/part{p}/{f}', f'{w}/composed/c{p * chunk + int(f[1:5]):04d}.png')
    os.rmdir(f'{w}/part{p}')
EOF
[ "$(ls "$WORK/composed" | wc -l)" = $TOTAL ] || { echo "compose failed"; exit 1; }
python3 "$KIT/loop.py" "$WORK/composed" "$WORK/frames" --crossfade $CROSSFADE --rotate $ROTATE

echo "== encode"
F="$WORK/frames/c%04d.png"
# WebP through Pillow, quality 60, a key frame every 24 frames: ffmpeg's encoder left a lasting ghost of the
# Clear tap mark on the Undo pill; regular key frames clear such leftovers within a second.
python3 "$HERE/webp.py" "$WORK/frames" "$OUT/sound-garden.webp" 60 24
# GIF: every other frame (15 fps, even spacing); area (box) downscale keeps the hairline rings from washing out,
# a light sharpen brings them back to full weight; one palette for the whole loop (no flicker), ordered dither
# (stable from frame to frame) so the pale backdrop does not band.
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$F" \
  -vf "select='not(mod(n\,2))',setpts=N/15/TB,scale=480:600:flags=area,unsharp=3:3:0.5:3:3:0,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  -r 15 -loop 0 "$OUT/sound-garden.gif"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$F" \
  -vf "scale=720:900:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -crf 21 -preset slow -movflags +faststart -an \
  "$OUT/sound-garden.mp4"

echo "== static picture, share card, screenshot"
(cd "$KIT" && node compose.js "$HERE/scene.html" "$WORK/score-still.json" "$WORK/raw" "$WORK/still" 1080 1350 1 $STILL $STILL)
(cd "$KIT" && node compose.js "$HERE/share.html" "$WORK/score.json" "$WORK/raw" "$WORK/share" 1200 630 1 $STILL $STILL)
python3 - "$WORK" "$OUT" <<'EOF'
import sys
from PIL import Image
w, o = sys.argv[1], sys.argv[2]
Image.open(f'{w}/still/c0000.png').convert('RGB').save(f'{o}/sound-garden.jpg', quality=88, optimize=True, progressive=True, subsampling=0)
Image.open(f'{w}/share/c0000.png').convert('RGB').save(f'{o}/share.jpg', quality=88, optimize=True, progressive=True, subsampling=0)
EOF
cp "$WORK/raw/f$(printf %04d $SHOT).png" "$OUT/screenshot.png"

echo "== checks (look at these: $WORK/sheet.png, $WORK/seam.png)"
python3 "$HERE/grid.py" "$WORK/frames" "$WORK/sheet.png" 9 220 30 0 16.2 0.9
python3 "$KIT/seam.py" "$WORK/frames" "$WORK/seam.png" 400
python3 - "$WORK" $LOOPLEN $CROSSFADE <<'EOF'
# How far the recording's end drifts from its start (the app's swaying backdrop sprigs): raw frame i against
# raw frame i + loop, over the crossfade frames. Under about 1 level mean / a few hundred changed pixels is fine;
# the crossfade on the quiet empty page hides it.
import sys
from PIL import Image, ImageChops
w, L, C = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
worst = 0
for i in range(C):
    a = Image.open(f'{w}/raw/f{i:04d}.png').convert('L'); b = Image.open(f'{w}/raw/f{i + L:04d}.png').convert('L')
    h = ImageChops.difference(a, b).histogram()
    changed = sum(h[8:]); mean = sum(k * v for k, v in enumerate(h)) / sum(h)
    worst = max(worst, changed)
    print(f'  loop drift, raw {i:3d} vs {i + L}: mean {mean:.3f}, pixels off by >= 8 levels: {changed}')
print('  worst', worst, 'pixels (of 1316640)')
EOF
ls -l "$OUT"
