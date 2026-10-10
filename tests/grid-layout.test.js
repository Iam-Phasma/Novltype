import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID_CELL, getGridClearArea, getGridClearAreas, isGridCellVisible } from '../src/grid-layout.js';

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function edges() {
  return {
    top: Array.from({ length: 60 }, (_, i) => i % 3),
    bottom: Array.from({ length: 60 }, (_, i) => (i + 1) % 3),
    left: Array.from({ length: 40 }, (_, i) => i % 3),
    right: Array.from({ length: 40 }, (_, i) => (i + 2) % 3),
  };
}

test('random edges never enter the padded hint and toolbar area at different layouts', () => {
  for (const rectangles of [
    [rect(250, 250, 300, 40), rect(70, 340, 660, 60)],
    [rect(600, 380, 220, 40), rect(400, 474, 760, 36)],
    [rect(300, 170, 400, 100), rect(160, 294, 680, 80)],
  ]) {
    const area = getGridClearArea(rectangles);
    for (const element of rectangles) {
      for (let r = 0; r < 30; r++) {
        for (let c = 0; c < 50; c++) {
          // Account for the canvas's one-cell shift to screen coordinates.
          const left = (c - 1) * GRID_CELL;
          const top = r * GRID_CELL;
          const intersects = left < element.right + 32 && left + GRID_CELL > element.left - 32 &&
            top < element.bottom + 32 && top + GRID_CELL > element.top - 32;
          if (intersects) assert.equal(isGridCellVisible(c, r, area, edges()), false);
        }
      }
    }
  }
});

test('clear area follows content movement and wrapping rather than screen percentages', () => {
  const initial = getGridClearArea([rect(300, 250, 200, 40), rect(100, 330, 600, 32)]);
  const wrapped = getGridClearArea([rect(300, 250, 200, 40), rect(100, 330, 600, 100)]);
  assert.ok(wrapped.bottom > initial.bottom);
  const moved = getGridClearArea([rect(300, 450, 200, 40), rect(100, 530, 600, 32)]);
  assert.ok(moved.top > initial.top);
});

test('edges retain stepped variation and leave the outer grid visible', () => {
  const area = getGridClearArea([rect(400, 300, 300, 60)]);
  const noise = edges();
  const c = area.left + 2;
  assert.equal(isGridCellVisible(c, area.top - 1, area, noise), noise.top[c] === 0);
  assert.equal(isGridCellVisible(0, 0, area, noise), true);
  assert.equal(isGridCellVisible(c, area.bottom, area, noise), noise.bottom[c] === 0);
});

test('hidden content leaves no artificial center cutout', () => {
  const area = getGridClearArea([rect(0, 0, 0, 0)]);
  assert.equal(area, null);
  assert.equal(isGridCellVisible(10, 10, area, edges()), true);
});

test('endgame preserves grid between the top-right toolbar and centered results', () => {
  const rectangles = [rect(1100, 20, 300, 36), rect(580, 380, 280, 100)];
  const areas = getGridClearAreas(rectangles);
  const noise = edges();
  assert.equal(areas.length, 2);
  // Screen point near (1200, 260) lies between the two controls.
  assert.ok(areas.every(area => isGridCellVisible(26, 5, area, noise)));
  assert.ok(areas.some(area => !isGridCellVisible(27, 0, area, noise)));
  assert.ok(areas.some(area => !isGridCellVisible(16, 9, area, noise)));
});

test('welcome retains a combined clear area for its centered controls', () => {
  assert.equal(getGridClearAreas([
    rect(600, 300, 240, 40), rect(360, 410, 760, 36),
  ], true).length, 1);
});
