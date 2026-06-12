// Headless-browser smoke test: serves the repo, loads the game in Chromium,
// and verifies it boots, renders, starts, and runs without console errors.
// Run with: npm run test:browser   (requires `npx playwright install chromium`)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let filePath = normalize(join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    if (!filePath.startsWith(normalize(ROOT))) throw new Error('traversal');
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;
console.log(`serving ${url}`);

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') failures.push(`console.error: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500); // let the attract demo run a moment

  // The attract screen (title + demo field) must actually be drawing pixels.
  const litPixels = await page.evaluate(() => {
    const c = document.getElementById('game');
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i] > 16 || img[i + 1] > 16 || img[i + 2] > 16) lit++;
    }
    return lit;
  });
  console.log(`lit pixels on attract screen: ${litPixels}`);
  if (litPixels < 500) failures.push(`attract screen nearly blank (${litPixels} lit pixels)`);

  const attractState = await page.evaluate(() => window.__game.state);
  if (attractState !== 'attract') failures.push(`expected attract state, got ${attractState}`);

  // Start a game and let it run.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const playing = await page.evaluate(() => ({
    state: window.__game.state,
    rocks: window.__game.asteroids.length,
    hasShip: Boolean(window.__game.ship),
    lives: window.__game.lives,
  }));
  console.log('after Enter:', JSON.stringify(playing));
  if (playing.state !== 'playing') failures.push(`expected playing state, got ${playing.state}`);
  if (playing.rocks < 1) failures.push('no asteroids spawned');
  if (!playing.hasShip) failures.push('no ship after start');

  // Hold thrust + rotate + fire for a couple of seconds of real gameplay.
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('Space');

  const after = await page.evaluate(() => ({
    state: window.__game.state,
    tick: window.__game.tick,
  }));
  console.log('after gameplay:', JSON.stringify(after));
  if (after.tick < 60) failures.push(`game loop barely advanced (tick=${after.tick})`);

  await mkdir(new URL('./artifacts/', import.meta.url), { recursive: true });
  const shot = fileURLToPath(new URL('./artifacts/smoke.png', import.meta.url));
  await page.screenshot({ path: shot });
  console.log(`screenshot: ${shot}`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nSMOKE FAILURES:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nSMOKE OK');
