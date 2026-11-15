// Renders the final preview frames: your scene page (HTML/CSS/JS) around the recorded app frames.
//
//   node compose.js <scene.html> <score.json> <rawFramesDir> <outDir> <width> <height> [scale=1] [first=0] [last=-1]
//
// For every recorded frame i it calls, inside your scene page:
//     await window.renderFrame({ i, total, fps, t, frameUrl, score })
// where t is seconds since the first saved frame, frameUrl is a file:// URL of the raw app frame, and
// score is your score.json. Your renderFrame must put that frame on screen (and draw anything else that
// depends on time, such as tap indicators) and RETURN A PROMISE that resolves once it is fully painted
// (e.g. await img.decode()). Then the page is screenshotted to <outDir>/c0000.png, ...
// Do not use CSS animations or timers in the scene: derive everything from t so frames are exact.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [scene, scorePath, rawDir, outDir, w, h, scaleArg, firstArg, lastArg] = process.argv.slice(2);
  if (!h) throw new Error('usage: node compose.js <scene.html> <score.json> <rawFramesDir> <outDir> <width> <height> [scale] [first] [last]');
  const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
  const frames = fs.readdirSync(rawDir).filter((f) => /^f\d+\.png$/.test(f)).sort();
  const first = Number(firstArg || 0);
  const last = lastArg === undefined || Number(lastArg) < 0 ? frames.length - 1 : Number(lastArg);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^c\d+\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(scaleArg || 1) });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + path.resolve(scene));
    await page.waitForFunction(() => typeof window.renderFrame === 'function');
    await page.evaluate(() => document.fonts.ready);
    const fps = score.fps || 30;
    let n = 0;
    for (let i = first; i <= last; i++) {
      const frameUrl = 'file://' + path.resolve(rawDir, frames[i]);
      await page.evaluate((a) => window.renderFrame(a), { i, total: frames.length, fps, t: i / fps, frameUrl, score });
      await page.screenshot({ path: path.join(outDir, `c${String(n).padStart(4, '0')}.png`) });
      n++;
    }
    console.log(JSON.stringify({ composed: n, width: Number(w) * Number(scaleArg || 1), height: Number(h) * Number(scaleArg || 1), errors }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
