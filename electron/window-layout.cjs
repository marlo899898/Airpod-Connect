const SIZES = { setup: { width: 680, height: 630 }, compact: { width: 430, height: 250 } };
function windowBounds(view, current, workArea) {
  const size = SIZES[view];
  if (!size) throw new Error('Invalid window view');
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  return {
    width, height,
    x: Math.max(workArea.x, Math.min(Math.round(current.x + (current.width - width) / 2), workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(current.y, workArea.y + workArea.height - height)),
  };
}
module.exports = { windowBounds, SIZES };
