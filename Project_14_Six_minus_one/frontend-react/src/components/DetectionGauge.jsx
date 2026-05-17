/**
 * Findings metric inside the combined audience + findings sidebar card.
 * Values are driven by legacy dashboardApp via initDashboard({ onDetectionGaugeUpdate }).
 */

/** @typedef {{ detected: number | null }} DetectionGaugeProps */

export function DetectionGauge({ detected }) {
  const placeholder = detected == null;
  const detectedText = placeholder ? "—" : String(detected);

  return (
    <section
      className={`detection-gauge-panel detection-gauge-findings${placeholder ? " is-placeholder" : ""}`}
      id="detectionGaugePanel"
      aria-label="Issue categories triggered for the selected accessibility focus"
    >
      <div className="detection-gauge-metric">
        <div className="detection-gauge-value" aria-live="polite">
          <strong>{detectedText}</strong>
        </div>
        <div className="detection-gauge-copy">
          <p className="detection-gauge-label">Issue categories triggered</p>
        </div>
      </div>
    </section>
  );
}
