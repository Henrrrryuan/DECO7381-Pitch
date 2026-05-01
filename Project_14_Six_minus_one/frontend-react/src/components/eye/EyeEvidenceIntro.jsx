export function EyeEvidenceIntro() {
  // Static explanation for the Eye Tracking route. EyeTrackingPage.jsx renders
  // this before the recording workflow so users understand that gaze data is
  // optional supporting evidence, not the main scoring method.
  return (
    <section className="eye-intro">
      <p className="upload-kicker">Optional Evidence</p>
      <h1>Eye-Tracking Evidence</h1>
      <p>
        Record gaze samples to support before-and-after comparisons. Link the
        session to a Report ID when you want the evidence to appear beside an
        analysis run in History.
      </p>
    </section>
  );
}
