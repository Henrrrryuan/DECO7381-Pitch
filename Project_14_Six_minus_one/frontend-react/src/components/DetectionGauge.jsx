/**
 * Axe-style metric card: big count + short label.
 * Values are driven by legacy dashboardApp via initDashboard({ onDetectionGaugeUpdate }).
 */

/** @typedef {{ detected: number | null }} DetectionGaugeProps */

export function DetectionGauge({ detected }) {
  const placeholder = detected == null;
  const detectedText = placeholder ? "—" : String(detected);

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
    </section>
  );
}
