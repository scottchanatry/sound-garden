// Behaviour check for a web build of Sound Garden. Exits 0 if every check passes.
//
//   node smoke.js /abs/path/to/web-build <port> [query]
//
// The optional third argument is a query string such as "?insets=47,34", which
// gives the web build a phone's safe areas.
//
// It relies on these testIDs, which every version of the app must keep:
//   ground  the tappable garden area (full screen)       seed    one per planted dot
//   count   text whose FIRST number is the dot count     toggle  the pause/play control
//   clear   the control that removes every dot           scatter the control that scatters a few seeds
// and on two things the version with a planting bed adds:
//   undo    what the clear control becomes for 5 s after dots are taken away
//   the planting bed, found by its spoken name: aria-label "Garden bed"
// A build with no planting bed (the first pass) is checked for the original
// behaviour only, and the script says so.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const WIDTH = 390;
const HEIGHT = 844;

(async () => {
  const [build, port = '8899'] = process.argv.slice(2);
  if (!build) throw new Error('usage: node smoke.js <webBuildDir> <port> [query]');
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(build), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const results = [];
  const notes = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail: String(detail) });
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    await page.addInitScript(() => {
      window.__plays = 0;
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays++; return play.call(this); };
    });
    await page.goto(`http://127.0.0.1:${port}/${process.argv[4] || ''}`);   // optional 3rd argument: a query string such as "?insets=47,34"
    await page.waitForSelector('[data-testid=ground]', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    const count = async () => {
      const text = (await page.textContent('[data-testid=count]')) || '';
      const m = text.match(/\d+/);
      return m ? Number(m[0]) : NaN;
    };
    const seeds = () => page.locator('[data-testid=seed]').count();
    const plays = () => page.evaluate(() => window.__plays);
    const run = (ms) => page.clock.runFor(ms);
    const has = async (id) => (await page.locator(`[data-testid=${id}]`).count()) > 0;
    const off = async (id) => (await page.getAttribute(`[data-testid=${id}]`, 'aria-disabled')) === 'true';
    const box = (selector) => page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }, selector);
    // The middle of every planted dot, in page points.
    const middles = () => page.evaluate(() => [...document.querySelectorAll('[data-testid=seed]')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    }));
    const closest = (points) => {
      let best = Infinity;
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) best = Math.min(best, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
      return best;
    };
    const tap = async (x, y, wait = 300) => { await page.touchscreen.tap(x, y); await run(wait); };
    const press = async (id, wait = 300) => { await page.tap(`[data-testid=${id}]`); await run(wait); };
    // Clears the garden and waits until the offer to undo has passed.
    const empty = async () => { if (await has('clear') && !(await off('clear'))) await press('clear'); await run(5300); };

    check('starts empty', (await count()) === 0 && (await seeds()) === 0, await count());

    const ground = await box('[data-testid=ground]');
    check('the garden fills the screen', ground && ground.left === 0 && ground.top === 0 && ground.right === WIDTH && ground.bottom === HEIGHT, JSON.stringify(ground));

    // The planting bed lies between the header and the controls. Touches outside it plant nothing.
    const bed = await box('[aria-label="Garden bed"]');
    if (!bed) notes.push('this build has no planting bed: the checks of the bed, undo, spacing and beats were skipped');
    if (bed) {
      const title = await box('[role=heading]');
      const tally = await box('[data-testid=count]');
      const keys = await box('[data-testid=toggle]');
      check('the bed lies between the header and the controls', title && keys && bed.top > title.bottom + 20 && bed.bottom < keys.top - 20 && bed.left >= 20 && bed.right <= WIDTH - 20, JSON.stringify(bed));
      await tap((title.left + title.right) / 2, (title.top + title.bottom) / 2);
      await tap((tally.left + tally.right) / 2, (tally.top + tally.bottom) / 2);
      await tap(WIDTH / 2, 8);
      await tap(3, (bed.top + bed.bottom) / 2);
      await tap(WIDTH / 2, bed.top - 26);
      check('touches outside the bed plant nothing', (await count()) === 0 && (await seeds()) === 0, await count());
    }

    for (const [x, y] of [[120, 300], [260, 420], [200, 620], [90, 520]]) await tap(x, y);
    check('4 taps plant 4 dots', (await count()) === 4 && (await seeds()) === 4, `count ${await count()}, seeds ${await seeds()}`);
    check('planting plays sound', (await plays()) >= 4, await plays());
    let before = await plays();
    await tap(120, 300);
    check('tapping a dot rings it without planting', (await count()) === 4 && (await plays()) > before, `count ${await count()}`);
    if (bed) {
      before = await plays();
      await tap(160, 300);
      check('tapping just beside a dot rings it, never plants on top', (await count()) === 4 && (await plays()) > before, `count ${await count()}`);
    }

    const hold = async (ms) => { await page.mouse.move(260, 420); await page.mouse.down(); await run(ms); };
    const release = async () => { await page.mouse.up(); await run(300); };
    await hold(900); await release();
    check('holding a dot removes it', (await count()) === 3 && (await seeds()) === 3, await count());
    if (bed) {
      check('undo is offered after a dot is removed', (await has('undo')) && !(await has('clear')));
      await run(300);
      if (await has('undo')) await press('undo');
      check('undo puts the dot back', (await count()) === 4 && (await seeds()) === 4 && (await has('clear')), `count ${await count()}, seeds ${await seeds()}`);
      await hold(200); await page.mouse.move(300, 440); await run(900); await release();
      check('sliding off a held dot keeps it', (await count()) === 4, await count());
      await hold(900); await release();
      check('holding it again removes it', (await count()) === 3, await count());
    }

    const p0 = await plays(); await run(9500); const p1 = await plays();
    check('dots pulse by themselves', p1 - p0 >= 2, `${p1 - p0} plays in 9.5s`);
    if (bed) check('the offer to undo ends by itself', !(await has('undo')) && (await has('clear')));
    await press('toggle', 3500);
    const p2 = await plays(); await run(9500); const p3 = await plays();
    check('pause stops self-pulsing', p3 - p2 === 0, `${p3 - p2} plays while paused`);
    if (bed) {
      await press('toggle', 500);
      check('play is heard within half a second', (await plays()) > p3, `${(await plays()) - p3} plays`);
      await press('toggle', 3500);
      await press('clear');
      check('clear returns the garden to playing', (await page.getAttribute('[data-testid=toggle]', 'aria-label')) === 'Pause the garden', await page.getAttribute('[data-testid=toggle]', 'aria-label'));
    } else {
      await press('toggle');
      await press('clear');
    }
    check('clear empties the garden', (await count()) === 0 && (await seeds()) === 0, await count());
    await empty();

    // Each dot keeps its own beat: planting a second one must not restart the first.
    // The two are too far apart to echo each other, so every play is a dot's own.
    if (bed) {
      const y = (bed.top + bed.bottom) / 2;
      await tap(bed.left + 6, y, 3000);
      const a = await plays();
      await tap(bed.right - 6, y, 1100);
      check('planting does not restart the other beats', (await plays()) - a >= 2, `${(await plays()) - a} plays`);
      await empty();
    }

    for (let i = 0; i < 16; i++) await tap(45 + (i % 4) * 95, 190 + Math.floor(i / 4) * 120, 80);
    await run(300);
    check('stops at 14 dots', (await count()) === 14 && (await seeds()) === 14, await count());

    if (bed) {
      const inBed = (points) => points.every((p) => p.x >= bed.left - 1 && p.x <= bed.right + 1 && p.y >= bed.top - 1 && p.y <= bed.bottom + 1);
      check('every dot is inside the bed', inBed(await middles()));
      check('scatter is off when the garden is full', await off('scatter'));
      await empty();

      // Scatter: off while its seeds are landing, and never two dots closer than 60 points.
      await press('scatter', 100);
      check('scatter is off while its seeds are landing', await off('scatter'));
      await run(2500);
      check('scatter plants a handful', (await count()) >= 4 && !(await off('scatter')), await count());
      await press('scatter', 2500);
      await press('scatter', 2500);
      const scattered = await middles();
      check('scattered dots keep apart and inside the bed', scattered.length >= 10 && closest(scattered) >= 59 && inBed(scattered), `${scattered.length} dots, closest ${closest(scattered).toFixed(1)}`);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight);
    check('no page scrolling/overflow', !overflow);
    check('no errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.kill();
  }
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
  for (const note of notes) console.log(`NOTE  ${note}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
