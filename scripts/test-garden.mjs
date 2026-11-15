// Quick checks of the garden's rules. Run with: node scripts/test-garden.mjs
import assert from 'node:assert/strict';
import { NOTE_COUNT, RIPPLE_REACH, RIPPLE_SPEED, noteForY, periodForX, reached, seedAt } from '../src/garden.js';

assert.equal(noteForY(0, 800), NOTE_COUNT - 1, 'top of the screen is the highest note');
assert.equal(noteForY(800, 800), 0, 'bottom of the screen is the lowest note');
assert.equal(noteForY(-50, 800), NOTE_COUNT - 1);
assert.equal(noteForY(400, 0), 0, 'no layout yet does not crash');

assert.ok(periodForX(0, 400) < periodForX(400, 400), 'further right is slower');

const a = { id: 1, x: 100, y: 100 };
const near = { id: 2, x: 100 + RIPPLE_SPEED, y: 100 };
const far = { id: 3, x: 100 + RIPPLE_REACH + 1, y: 100 };
const hits = reached(a, [a, near, far]);
assert.deepEqual(hits.map((hit) => hit.id), [2], 'only seeds within reach are hit, and never the source');
assert.ok(Math.abs(hits[0].delay - 1000) < 1e-6, 'a seed one second away is reached after one second');

assert.equal(seedAt({ x: 104, y: 103 }, [a, near]).id, 1);
assert.equal(seedAt({ x: 300, y: 300 }, [a, near]), null);

console.log('garden rules: all checks passed');
