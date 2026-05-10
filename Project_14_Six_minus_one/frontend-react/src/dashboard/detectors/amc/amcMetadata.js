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
    issue: "Automatic movement may distract users.",
    impact: "We check autoplay media and continuously moving components.",
  },
  guidance: {
    steps: [
      "Disable autoplay by default.",
      "Reduce non-essential continuous motion or make it user initiated.",
    ],
    goal: "Keep motion under user control instead of starting automatically.",
    done_when: "Done when media or animation starts only after the user chooses it.",
  },
};

export { amcMetadata };

