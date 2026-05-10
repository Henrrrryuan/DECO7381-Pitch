import { memo } from "react";

import { PATIENT_PROFILES } from "../../dashboard/shared/patientProfiles.js";

const PRIORITY_LENS_KEYS = ["General", "Alison", "Amy", "Tal", "Yuki"];

function PriorityLensPanelInner() {
  const general = PATIENT_PROFILES.General;

  return (
    <section className="patient-profile-panel" aria-label="Priority Lens">
      <div className="patient-profile-heading">
        <h2 className="patient-profile-title">Priority Lens</h2>
      </div>
      <div className="patient-profile-tabs" role="group" aria-label="Choose priority lens">
        {PRIORITY_LENS_KEYS.map((key) => {
          const profile = PATIENT_PROFILES[key];
          const isDefault = key === "General";
          return (
            <button
              key={key}
              type="button"
              className={`patient-profile-tab${isDefault ? " is-active" : ""}`}
              data-patient-profile={key}
              aria-pressed={isDefault ? "true" : "false"}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
      <p id="patientProfileSummary" className="patient-profile-summary">
        <strong>{general.condition}</strong>
        <span>
          {general.summary}
        </span>
      </p>
    </section>
  );
}

/** Memoized so parent gauge/state re-renders do not reconcile away legacy-updated tab/summary DOM. */
export const PriorityLensPanel = memo(PriorityLensPanelInner);
