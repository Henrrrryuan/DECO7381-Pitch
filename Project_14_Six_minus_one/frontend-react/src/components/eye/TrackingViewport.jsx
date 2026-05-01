export function TrackingViewport({
  targetFrameSource,
  targetFrameRef,
  heatmapCanvasRef,
  gazeDotRef,
  onFrameLoad,
  onFrameError,
}) {
  // Live recording surface. EyeTrackingPage.jsx passes refs into this component
  // so page-level logic can draw the heatmap canvas and read iframe dimensions
  // without forcing the visual component to own tracking calculations.
  return (
    <section className="eye-viewport-shell" aria-label="Gaze tracking area">
      <iframe
        ref={targetFrameRef}
        title="Tracked webpage"
        src={targetFrameSource}
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={onFrameLoad}
        onError={onFrameError}
      />
      <canvas ref={heatmapCanvasRef} aria-hidden="true" />
      <div ref={gazeDotRef} className="eye-gaze-dot" aria-hidden="true" />
    </section>
  );
}
