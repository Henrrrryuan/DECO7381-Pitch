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
    issue: "Overlays or popups may interrupt the task.",
    impact: "We check dialogs, modals, sticky prompts, and interruption scripts.",
  },
  guidance: {
    steps: [
      "Avoid showing popups, sticky prompts, or overlays on initial load.",
      "Provide a clear dismiss control and keep prompts out of the primary task flow.",
    ],
    goal: "Avoid interruptions before users finish the main reading or task path.",
    done_when: "Done when popups or sticky prompts no longer interrupt the first task path.",
  },
};

export { eiMetadata };

