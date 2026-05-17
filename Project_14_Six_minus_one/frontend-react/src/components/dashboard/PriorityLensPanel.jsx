import { memo } from "react";

import { PATIENT_PROFILES } from "../../dashboard/shared/patientProfiles.js";

const PRIORITY_LENS_KEYS = ["Alison", "Amy", "Tal", "Yuki"];

function PriorityLensPanelInner() {
  const alison = PATIENT_PROFILES.Alison;

  return (
    <section className="patient-profile-panel" aria-label="Accessibility focus">
      <div className="patient-profile-heading">
        <h2 className="patient-profile-title">Accessibility focus</h2>
      </div>
      <div className="patient-profile-tabs" role="group" aria-label="Choose accessibility focus">
        {PRIORITY_LENS_KEYS.map((key) => {
          const profile = PATIENT_PROFILES[key];
          const isAlison = key === "Alison";
          return (
            <button
              key={key}
              type="button"
              className={`patient-profile-tab${isAlison ? " is-active" : ""}`}
              data-patient-profile={key}
              data-accessibility-tooltip={`Show issues most relevant to ${profile.condition}. Focus: ${profile.focusKeywords.join(", ")}.`}
              aria-pressed={isAlison ? "true" : "false"}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
      <div id="patientProfileSummary" className="patient-profile-selected-focus">
        <p id="patientProfileFocusChips" className="patient-profile-focus-chips" aria-live="polite">
          {alison.focusKeywords.join(" · ")}
        </p>
      </div>
    </section>
  );
}

/** Memoized so parent gauge/state re-renders do not reconcile away legacy-updated tab/summary DOM. */
export const PriorityLensPanel = memo(PriorityLensPanelInner);
