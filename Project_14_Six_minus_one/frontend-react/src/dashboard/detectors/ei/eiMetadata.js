const eiMetadata = {
  rule_id: "EI-1",
  dimension: "Excessive Interruptions",
  frameworks: {
    coga: "COGA: Limit Interruptions",
    iso: "ISO 9241-11: Satisfaction",
    wcag: "WCAG SC 3.2.1 On Focus; SC 3.2.2 On Input",
  },
  coga_objective: "Objective 5: Help users focus",
  tooltip: {
    issue: "Static signs of initial-load interruptions may interrupt the task.",
    impact: "We check dialogs, sticky prompts, overlays, aria-live regions, and interruption-related scripts; this does not simulate all user-triggered focus or input changes.",
  },
  guidance: {
    steps: [
      "Avoid showing dialogs, sticky prompts, overlays, or assertive notices before users can start the main task.",
      "Keep optional prompts out of the primary task flow and provide a clear dismiss control when they are necessary.",
    ],
    goal: "Reduce static interruption signals that can break the first reading or task path.",
    done_when: "Done when initial-load prompts no longer cover, interrupt, or compete with the main task path.",
  },
};

export { eiMetadata };
