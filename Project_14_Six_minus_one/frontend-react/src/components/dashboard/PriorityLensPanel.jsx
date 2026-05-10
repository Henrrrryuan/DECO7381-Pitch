import { memo } from "react";

import { PATIENT_PROFILES } from "../../dashboard/shared/patientProfiles.js";

const PRIORITY_LENS_KEYS = ["Alison", "Amy", "Tal", "Yuki"];

function PriorityLensPanelInner() {
  const alison = PATIENT_PROFILES.Alison;

  return (
    <section className="patient-profile-panel" aria-label="Target audience">
      <div className="patient-profile-heading">
        <h2 className="patient-profile-title">Target audience</h2>
      </div>
      <div className="patient-profile-tabs" role="group" aria-label="Choose target audience">
        {PRIORITY_LENS_KEYS.map((key) => {
          const profile = PATIENT_PROFILES[key];
          const isAlison = key === "Alison";
          return (
            <button
              key={key}
              type="button"
              className={`patient-profile-tab${isAlison ? " is-active" : ""}`}
              data-patient-profile={key}
              aria-pressed={isAlison ? "true" : "false"}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
      <p id="patientProfileSummary" className="patient-profile-summary">
        <span>
          {alison.summary}
        </span>
      </p>
    </section>
  );
}

/** Memoized so parent gauge/state re-renders do not reconcile away legacy-updated tab/summary DOM. */
export const PriorityLensPanel = memo(PriorityLensPanelInner);
