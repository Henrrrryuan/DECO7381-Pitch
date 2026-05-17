/**
 * Eye-tracking heatmap layout helpers for History (full-page grid, not viewport-only).
 */
const MIN_ROW_TRACK_PX = 8;
const MAX_ROW_TRACK_PX = 96;
const MIN_COL_TRACK_PX = 10;
/** When page size was not saved, assume a typical long content page. */
const FALLBACK_PAGE_HEIGHT_RATIO = 2.8;

export function getEyeHeatmapPageMetrics(detail) {
  const summary = detail?.summary && typeof detail.summary === "object" ? detail.summary : {};
  const documentWidth = Number(summary.document_width);
  const documentHeight = Number(summary.document_height);
  const viewportWidth = Number(summary.viewport_width);
  const viewportHeight = Number(summary.viewport_height);

  const hasDocumentSize =
    Number.isFinite(documentWidth) &&
    documentWidth > 0 &&
    Number.isFinite(documentHeight) &&
    documentHeight > 0;

  return {
    hasDocumentSize,
    documentWidth: hasDocumentSize ? documentWidth : 0,
    documentHeight: hasDocumentSize ? documentHeight : 0,
    viewportWidth: Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0,
    viewportHeight: Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0,
  };
}

export function getHeatmapPageAspectRatio(pageMetrics, gridCols, gridRows) {
  const cols = Math.max(1, Number(gridCols) || 1);
  const rows = Math.max(1, Number(gridRows) || 1);

  if (pageMetrics?.hasDocumentSize) {
    return pageMetrics.documentHeight / pageMetrics.documentWidth;
  }

  if (pageMetrics?.viewportWidth > 0 && pageMetrics?.viewportHeight > 0) {
    const viewportRatio = pageMetrics.viewportHeight / pageMetrics.viewportWidth;
    return Math.max(viewportRatio * 2, rows / cols);
  }

  return Math.max(FALLBACK_PAGE_HEIGHT_RATIO, rows / cols);
}

/**
 * Pixel layout so the grid keeps full-page proportions and scrolls inside the modal
 * (never shrinks into a single-screen thumbnail).
 */
export function getHeatmapGridPixelLayout(pageMetrics, gridCols, gridRows, containerWidth = 320) {
  const cols = Math.max(1, Number(gridCols) || 1);
  const rows = Math.max(1, Number(gridRows) || 1);
  const width = Math.max(220, Math.round(Number(containerWidth) || 320));
  const pageAspect = getHeatmapPageAspectRatio(pageMetrics, cols, rows);

  const colTrackPx = Math.max(MIN_COL_TRACK_PX, width / cols);
  const gridWidth = Math.round(colTrackPx * cols);
  const rawRowTrackPx = (gridWidth * pageAspect) / rows;
  const rowTrackPx = pageMetrics?.hasDocumentSize
    ? Math.max(MIN_ROW_TRACK_PX, rawRowTrackPx)
    : Math.min(MAX_ROW_TRACK_PX, Math.max(MIN_ROW_TRACK_PX, rawRowTrackPx));
  const gridHeight = Math.round(rowTrackPx * rows);

  return {
    width: gridWidth,
    height: gridHeight,
    gridTemplateColumns: `repeat(${cols}, ${colTrackPx}px)`,
    gridTemplateRows: `repeat(${rows}, ${rowTrackPx}px)`,
    pageAspect,
    usesEstimatedPageSize: !pageMetrics?.hasDocumentSize,
  };
}

export function formatHeatmapPageSizeLabel(pageMetrics) {
  if (!pageMetrics?.hasDocumentSize) {
    return "";
  }
  const w = Math.round(pageMetrics.documentWidth);
  const h = Math.round(pageMetrics.documentHeight);
  return `Page size: ${w}×${h}px`;
}
