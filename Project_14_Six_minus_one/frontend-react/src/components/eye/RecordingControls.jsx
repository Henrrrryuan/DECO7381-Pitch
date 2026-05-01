export function RecordingControls({
  isStarted,
  isPaused,
  isPreviewVisible,
  canSave,
  isSaving,
  onStartTracking,
  onTogglePause,
  onClearHeatmap,
  onTogglePreview,
  onSaveSession,
}) {
  // Step 3 in the workflow. These buttons trigger callbacks owned by
  // EyeTrackingPage.jsx, where GazeCloudAPI, canvas drawing, and saving logic
  // are managed.
  return (
    <section className="eye-step-panel" aria-labelledby="recordingTitle">
      <div className="eye-step-label">Step 3</div>
      <h2 id="recordingTitle">Record Eye Evidence</h2>
      <p>
        Start recording, follow the calibration overlay, then save the session
        once enough samples have been collected.
      </p>

      <div className="eye-control-grid">
        <button
          className="eye-primary-button"
          type="button"
          disabled={isStarted}
          onClick={onStartTracking}
        >
          Start Tracking
        </button>
        <button type="button" disabled={!isStarted} onClick={onTogglePause}>
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button type="button" disabled={!isStarted} onClick={onClearHeatmap}>
          Clear Heatmap
        </button>
        <button type="button" disabled={!isStarted} onClick={onTogglePreview}>
          {isPreviewVisible ? "Hide Camera Preview" : "Show Camera Preview"}
        </button>
        <button
          className="eye-save-button"
          type="button"
          disabled={!canSave}
          onClick={onSaveSession}
        >
          {isSaving ? "Saving..." : "Save Session"}
        </button>
      </div>
    </section>
  );
}
