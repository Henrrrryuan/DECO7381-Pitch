const amcMetadata = {
  rule_id: "AMC-1",
  dimension: "Auto-Moving Content",
  frameworks: {
    coga: "COGA: Limit Interruptions",
    iso: "ISO 9241-11: Satisfaction",
    wcag: "WCAG SC 2.2.2 Pause, Stop, Hide; SC 1.4.2 Audio Control",
  },
  coga_objective: "Objective 5: Help users focus",
  tooltip: {
    issue: "Static motion or autoplay signals may distract users.",
    impact: "We check autoplay media and motion or animation hints; this does not verify whether every motion control meets WCAG timing or pause-control requirements.",
  },
  guidance: {
    steps: [
      "Disable autoplay or automatic motion by default where it is not essential to the task.",
      "Reduce non-essential continuous motion, or make it user initiated with clear controls.",
    ],
    goal: "Treat autoplay and motion findings as static risk signals and keep non-essential movement under user control.",
    done_when: "Done when flagged motion or autoplay no longer starts automatically, or users have clear control before it competes for attention.",
  },
};

export { amcMetadata };
