/**
 * Axe-style metric card: big count + short label.
 * Values are driven by legacy dashboardApp via initDashboard({ onDetectionGaugeUpdate }).
 */

/** @typedef {{ content: number; structure: number; motion: number; forms: number }} IssueBreakdown */
/** @typedef {{ detected: number | null; total: number | null; breakdown?: IssueBreakdown | null }} DetectionGaugeProps */

function pill(label, value, tone) {
  return (
    <span className={`detection-gauge-pill detection-gauge-pill--${tone}`}>
      <span className="detection-gauge-pill__label">{label}</span>
      <strong className="detection-gauge-pill__value">{value}</strong>
    </span>
  );
}

export function DetectionGauge({ detected, breakdown = null }) {
  const placeholder = detected == null;
  const detectedText = placeholder ? "—" : String(detected);
  const safe = breakdown && typeof breakdown === "object"
    ? {
        content: Number(breakdown.content || 0),
        structure: Number(breakdown.structure || 0),
        motion: Number(breakdown.motion || 0),
        forms: Number(breakdown.forms || 0),
      }
    : null;

  return (
    <section
      className={`detection-gauge-panel detection-gauge-card${placeholder ? " is-placeholder" : ""}`}
      id="detectionGaugePanel"
      aria-label="Detected issues"
    >
      <p className="detection-gauge-title">Detected issues</p>
      <div className="detection-gauge-value" aria-live="polite">
        <strong>{detectedText}</strong>
      </div>
      {safe ? (
        <div className="detection-gauge-pills" aria-label="Issue breakdown">
          {pill("Content", safe.content, "content")}
          {pill("Structure", safe.structure, "structure")}
          {pill("Motion", safe.motion, "motion")}
          {safe.forms ? pill("Forms", safe.forms, "forms") : null}
        </div>
      ) : (
        <div className="detection-gauge-pills is-placeholder" aria-hidden="true" />
      )}
    </section>
  );
}
