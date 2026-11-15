// Records frames from the REAL Sound Garden app (its web build), with exact timing.
//
//   node capture.js <score.json> <outDir>
//
// score.json:
//   {
//     "width": 390, "height": 844,      // app viewport in CSS px (phone-sized)
//     "scale": 2,                       // device pixel ratio of the saved PNGs
//     "fps": 30,                        // frames per second of fake time
//     "start": 0,                       // seconds: first frame to save
//     "end": 8,                         // seconds: stop here (exclusive)
//     "port": 8801,                     // port to serve the app on (pick your own)
//     "events": [                       // what the "finger" does, in seconds of app time
//       {"t": 0.5, "tap": [120, 300]},        // tap: plants a seed in the bed, rings a plant if one is there
//       {"t": 3.0, "press": "toggle"},        // press the Pause/Play button
//       {"t": 6.0, "hold": [120, 300]},       // press and hold 0.7s: pulls up the plant there
//       {"t": 7.0, "press": "clear"}          // press Clear
//     ],
//     "webBuild": "/path/to/web/build",  // optional: record a different build of the app
//     "query": "?insets=47,34",          // optional: give the web build a phone's safe areas (top,bottom)
//     "seed": 7                          // optional: make Math.random repeatable, so Scatter repeats
//   }
//
// Time is virtual: the page's clock is frozen and stepped one frame at a time, so
// frames are evenly spaced no matter how long a screenshot takes. Saved as
// <outDir>/f0000.png, f0001.png, ...
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// By default, record the web build made by: npx expo export --platform web
const DEFAULT_WEB_BUILD = path.join(__dirname, '..', '..', 'dist');

(async () => {
  const [scorePath, outDir] = process.argv.slice(2);
  if (!scorePath || !outDir) throw new Error('usage: node capture.js <score.json> <outDir>');
  const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
  const { width = 390, height = 844, scale = 2, fps = 30, start = 0, end = 8, port = 8801, events = [] } = score;
  const WEB_BUILD = score.webBuild ? path.resolve(score.webBuild) : DEFAULT_WEB_BUILD;   // "webBuild": folder of an `expo export --platform web` build
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));

  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: WEB_BUILD, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    if (score.seed !== undefined) {
      // "seed": makes Math.random repeatable, so Scatter lands in the same places on every recording.
      await page.addInitScript((seed) => {
        let state = seed >>> 0;
        Math.random = () => {
          state = (state + 0x6D2B79F5) >>> 0;
          let t = state;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }, score.seed);
    }
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/${score.query || ''}`);   // "query": e.g. "?insets=47,34" to give the web build a phone's safe areas
    await page.waitForSelector('[data-testid=ground]');
    await page.waitForTimeout(600);                    // real time: let fonts and layout settle
    await page.clock.install();                        // from here on, time only moves when we say so
    await page.clock.pauseAt(Date.now() + 1000);

    const step = 1000 / fps;
    const pending = [...events].sort((a, b) => a.t - b.t);
    const holds = [];
    const total = Math.round(end * fps);
    const first = Math.round(start * fps);
    let saved = 0;
    for (let frame = 0; frame < total; frame++) {
      const now = frame / fps;
      while (pending.length && pending[0].t <= now + 1e-9) {
        const ev = pending.shift();
        if (ev.tap) await page.touchscreen.tap(ev.tap[0], ev.tap[1]);
        else if (ev.press) await page.tap(`[data-testid=${ev.press}]`);
        else if (ev.hold) {
          await page.mouse.move(ev.hold[0], ev.hold[1]);
          await page.mouse.down();
          holds.push(now + 0.7);
        }
      }
      while (holds.length && holds[0] <= now + 1e-9) {
        holds.shift();
        await page.mouse.up();
      }
      if (frame >= first) {
        await page.screenshot({ path: path.join(outDir, `f${String(saved).padStart(4, '0')}.png`) });
        saved++;
      }
      await page.clock.runFor(step);
    }
    const count = await page.textContent('[data-testid=count]').catch(() => '?');
    console.log(JSON.stringify({ saved, fps, width: width * scale, height: height * scale, dotsAtEnd: (count || '').trim(), errors }));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
