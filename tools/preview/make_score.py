"""Writes the score for the "Plate" preview.

   python3 make_score.py <out.json> [--port 8921] [--test | --wide]

The story is written once, as offsets (seconds) from the press of Clear that ends the cycle before it.
It is played several times in a row, so that the recorded window is one exact period of the app:
what is on screen 1.4 s after one Clear is what is on screen 1.4 s after the next.

   (default)  the window that is delivered: LOOP seconds plus CROSSFADE frames for loop.py --crossfade
   --wide     the same with 3 s more at each end, to choose the window from
   --test     one cycle from a fresh start, for looking at the choreography
"""
import json, sys

FPS = 30
LOOP = 16.2                      # seconds, one cycle of the story (486 frames)
FIRST = 10.5                     # the first cycle starts here on the recording clock
LEAD_IN = 1.4                    # the recorded window starts this long after a Clear
CROSSFADE = 12                   # extra frames recorded for loop.py --crossfade
BUILD = None   # make.sh passes --build

# The ten plants, one of each species, lowest note first (x, y in app points).
PLANTS = {
    'seedling':        (112, 670),
    'clover':          (236, 617),
    'grass tuft':      (92, 564),
    'toothed rosette': (196, 511),
    'rosette in bud':  (298, 458),
    'rosebud':         (118, 406),
    'wild rose':       (230, 353),
    'cosmos':          (88, 300),
    'daisy':           (300, 247),
    'daffodil':        (176, 194),
}
CLEAR, TOGGLE = (87, 776), (195, 776)


def plant(t, name):
    return {'t': t, 'tap': list(PLANTS[name]), 'what': 'plant ' + name}


def ring(t, name, dx=0, dy=0):
    x, y = PLANTS[name]
    return {'t': t, 'tap': [x + dx, y + dy], 'what': 'ring ' + name}


STORY = [
    # planting: a slow first seed, then quicker up the scale, one pause to look (rosebud -> wild rose),
    # and a small cadence on the daffodil
    plant(2.20, 'seedling'),
    plant(2.90, 'clover'),
    plant(3.35, 'grass tuft'),
    plant(3.80, 'toothed rosette'),
    plant(4.40, 'rosette in bud'),
    plant(4.75, 'rosebud'),
    plant(5.40, 'wild rose'),
    plant(5.70, 'cosmos'),
    plant(6.00, 'daisy'),
    plant(6.50, 'daffodil'),
    # a little melody, played by hand, a touch off-centre like a real finger
    ring(7.50, 'wild rose', 5, -4),
    ring(7.80, 'daisy', -5, 4),
    ring(8.10, 'daffodil', 4, 5),
    ring(8.65, 'rosebud', -5, -4),
    ring(8.90, 'toothed rosette', 6, 3),
    ring(9.55, 'clover', -4, 5),
    # rest (long enough for the last rings to fade, so the garden is still), wake, clear
    {'t': 10.35, 'press': 'toggle', 'at': list(TOGGLE), 'what': 'pause'},
    {'t': 13.00, 'press': 'toggle', 'at': list(TOGGLE), 'what': 'play'},
    {'t': LOOP,  'press': 'clear',  'at': list(CLEAR),  'what': 'clear'},
]

# Captions on the page, as [from, to) in story time (they wrap round the loop). Four, each at full
# opacity for at least 2.4 s (a caption is fully in 0.6 s after its "from").
CAPTIONS = [
    {'from': 0.00,  'to': 4.30,  'fig': 1, 'lines': ['Tap to plant', 'a sound']},
    {'from': 4.30,  'to': 7.30,  'fig': 2, 'lines': ['Higher up,', 'higher notes']},
    {'from': 7.30,  'to': 10.30, 'fig': 3, 'lines': ['Ripples wake', 'the neighbours']},
    {'from': 10.30, 'to': 16.20, 'fig': 4, 'lines': ['Rest,', 'then wake']},
]


def build(mode='final', port=8921, web=BUILD):
    if mode == 'test':
        first, start, end = 0.0, 0.0, LOOP + 2.0
    else:
        # The backdrop sprigs in the app sway with periods of 22 s and 28 s, which no loop of 12-18 s
        # divides. Their swing is symmetric about its turning points, and both turn about 55 s after the
        # app starts (measured: 52.3 s and 53.3 s on the recording clock), so a window centred near 52.5 s
        # begins and ends with the sprigs in the same place, to within half a pixel. A short crossfade
        # (CROSSFADE frames) hides what is left. FIRST and LEAD_IN put that window on the quiet empty page.
        first = FIRST
        start = first + 2 * LOOP + LEAD_IN        # a little after the second Clear: the quiet empty page
        end = start + LOOP + CROSSFADE / FPS
        if mode == 'wide':
            start, end = start - 3.0, end + 3.0

    # Every time is a whole number of frames, and every cycle is the same number of frames after the last,
    # so each cycle plays out identically, frame for frame.
    events = []
    f0, fl = round(first * FPS), round(LOOP * FPS)
    k = 0
    while (f0 + k * fl) / FPS < end + 1.0:
        for ev in STORY:
            e = dict(ev)
            e['t'] = (f0 + k * fl + int(ev['t'] * FPS + 0.5 + 1e-6)) / FPS
            if e['t'] < end + 1.0:
                events.append(e)
        k += 1

    return {
        'width': 390, 'height': 844, 'scale': 2, 'fps': FPS,
        'start': round(start * FPS) / FPS, 'end': round(end * FPS) / FPS, 'port': port,
        'webBuild': web, 'query': '?insets=47,34',
        'loop': LOOP, 'storyStart': first, 'crossfade': CROSSFADE, 'captions': CAPTIONS,
        'events': sorted(events, key=lambda e: e['t']),
    }


if __name__ == '__main__':
    out = sys.argv[1]
    port = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else 8921
    mode = 'test' if '--test' in sys.argv else 'wide' if '--wide' in sys.argv else 'final'
    web = sys.argv[sys.argv.index('--build') + 1] if '--build' in sys.argv else BUILD
    score = build(mode, port, web)
    json.dump(score, open(out, 'w'), indent=1)
    print(out, 'start', score['start'], 'end', score['end'], 'events', len(score['events']))
