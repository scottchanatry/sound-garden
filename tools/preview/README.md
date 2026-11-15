# Recording the app

These scripts record the real app, frame by frame, and turn the frames into
the animated preview. They are not part of the app.

They need [Playwright](https://playwright.dev) with Chromium, `ffmpeg`, and
Python 3 with Pillow.

## 1. Build the app for the web

```bash
npx expo export --platform web
```

## 2. Check that it behaves

```bash
node tools/preview/smoke.js "$PWD/dist" 8800 "?insets=47,34"
```

It plants, rings, pauses, clears and fills the garden, and prints
`ALL PASSED` when every rule holds.

## 3. Record

A score is a list of taps, holds and button presses with their times; see
the comment at the top of `capture.js` and `example-score.json`.

```bash
node tools/preview/capture.js "$PWD/tools/preview/example-score.json" /tmp/raw
```

Time is virtual, so frames are evenly spaced however long a screenshot
takes. The query `?insets=47,34` gives the web build a phone's safe areas.

## 4. Put the frames in a scene, loop and encode

```bash
node tools/preview/compose.js "$PWD/tools/preview/scene.html" "$PWD/tools/preview/example-score.json" /tmp/raw /tmp/composed 1080 1350
```

```bash
python3 tools/preview/loop.py /tmp/composed /tmp/frames --crossfade 12
```

```bash
python3 tools/preview/encode.py /tmp/frames /tmp/preview --fps 30
```

`scene.html` draws each frame inside a phone on a pale page and marks the
taps. `sheet.py` and `seam.py` make contact sheets for checking the result.
