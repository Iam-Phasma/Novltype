export const GRID_CELL = 48;
const CONTENT_PADDING = 32;

export function getGridClearAreas(rectangles, combine = false) {
  const areas = combine
    ? [getGridClearArea(rectangles)]
    : rectangles.map(rect => getGridClearArea([rect]));
  return areas.filter(Boolean);
}

// The canvas is shifted left by one cell; bounds use canvas coordinates.
export function getGridClearArea(rectangles, cellSize = GRID_CELL) {
  const visible = rectangles.filter(rect => rect.width > 0 && rect.height > 0);
  if (!visible.length) return null;
  return {
    top: Math.floor((Math.min(...visible.map(rect => rect.top)) - CONTENT_PADDING) / cellSize),
    bottom: Math.ceil((Math.max(...visible.map(rect => rect.bottom)) + CONTENT_PADDING) / cellSize),
    left: Math.floor((Math.min(...visible.map(rect => rect.left)) - CONTENT_PADDING + cellSize) / cellSize) - 1,
    right: Math.ceil((Math.max(...visible.map(rect => rect.right)) + CONTENT_PADDING + cellSize) / cellSize),
  };
}

export function isGridCellVisible(c, r, clearArea, edges) {
  if (!clearArea) return true;
  const top = clearArea.top - (edges.top[c] || 0);
  const bottom = clearArea.bottom + (edges.bottom[c] || 0);
  const left = clearArea.left - (edges.left[r] || 0);
  const right = clearArea.right + (edges.right[r] || 0);
  return !(r >= top && r < bottom && c > left && c < right);
}
