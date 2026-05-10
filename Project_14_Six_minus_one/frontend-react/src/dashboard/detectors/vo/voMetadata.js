const voMetadata = {
  rule_id: "VO-1",
  dimension: "Visual Overload",
  frameworks: {
    coga: "COGA: Avoid Too Much Content",
    iso: "ISO 9241-11: Efficiency; Satisfaction",
    wcag: "WCAG SC 2.4.3 Focus Order; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Objective 5: Help users focus",
  tooltip: {
    issue: "The early-page DOM may contain a high concentration of competing elements.",
    impact: "We use an early-page structural density heuristic (element and interactive counts), not rendered viewport geometry.",
  },
  guidance: {
    steps: [
      "Reduce competing elements in the early-page markup structure.",
      "Group related content and remove non-essential cards, banners, or controls.",
    ],
    goal: "Reduce competing focal points and support one dominant task path.",
    done_when: "Done when one clear primary focus dominates the early-page structure.",
  },
};

export { voMetadata };

