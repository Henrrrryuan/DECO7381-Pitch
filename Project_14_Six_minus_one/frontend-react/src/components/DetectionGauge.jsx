/**
 * Semi-circle detector summary (issues-with-hits vs total rule slots).
 * Values are driven by legacy dashboardApp via initDashboard({ onDetectionGaugeUpdate }).
 */

/** @typedef {{ detected: number | null; total: number | null }} DetectionGaugeProps */

export function DetectionGauge({ detected, total }) {
  const placeholder = detected == null || total == null;
  const ratio =
    placeholder || total <= 0 ? 0 : Math.min(1, Math.max(0, detected / total));
  const progressOffset = 100 - ratio * 100;

  const detectedText = placeholder ? "—" : String(detected);

  return (
    <section
      className={`detection-gauge-panel${placeholder ? " is-placeholder" : ""}`}
      id="detectionGaugePanel"
      aria-label="Detectors with issues"
    >
      <div className="detection-gauge">
        <svg className="detection-gauge-svg" viewBox="0 0 200 112" aria-hidden="true" focusable="false">
          <path
            className="detection-gauge-base"
            d="M 24 96 A 76 76 0 0 1 176 96"
            fill="none"
            pathLength={100}
          />
          <path
            className="detection-gauge-progress"
            d="M 24 96 A 76 76 0 0 1 176 96"
            fill="none"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={progressOffset}
          />
        </svg>
        <div className="detection-gauge-value" aria-live="polite">
          <strong>{detectedText}</strong>
        </div>
        <p className="detection-gauge-caption">
          Detected issues
        </p>
      </div>
    </section>
  );
}
