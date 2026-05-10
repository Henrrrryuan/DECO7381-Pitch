/**
 * Semi-circle detector summary (issues-with-hits vs total rule slots).
 * Values are driven by legacy dashboardApp via initDashboard({ onDetectionGaugeUpdate }).
 */

/** @typedef {{ detected: number | null; total: number | null }} DetectionGaugeProps */

export function DetectionGauge({ detected, total }) {
  const placeholder = detected == null || total == null;
  const ratio =
    placeholder || total <= 0 ? 0 : Math.min(1, Math.max(0, detected / total));
  const redOffset = 100 - ratio * 100;
  const greenOffset = ratio * 100;

  const fractionText = placeholder ? "— / —" : `${detected}/${total}`;
  const targetText = placeholder ? "—" : String(total);

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
            className="detection-gauge-green"
            d="M 176 96 A 76 76 0 0 0 24 96"
            fill="none"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={greenOffset}
          />
          <path
            className="detection-gauge-fill"
            d="M 24 96 A 76 76 0 0 1 176 96"
            fill="none"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={redOffset}
          />
        </svg>
        <div className="detection-gauge-value" aria-live="polite">
          <strong>{fractionText}</strong>
        </div>
        <p className="detection-gauge-caption">
          Target to meet: <span>{targetText}</span>
        </p>
      </div>
    </section>
  );
}
