const wipMetadata = {
  rule_id: "WIP-1",
  dimension: "Weak Information Prominence",
  frameworks: {
    coga: "COGA: Make Important Tasks Easy to Find",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG SC 3.2.4 Consistent Identification; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Objective 2: Help users find what they need",
  tooltip: {
    issue: "Multiple CTA-like controls appear early in DOM order.",
    impact: "Early-page CTA density heuristic: multiple CTA-like controls in markup order can make the next step unclear; this is not a rendered visual prominence test.",
  },
  guidance: {
    steps: [
      "Choose one primary action for the early-page flow and demote or defer competing CTA-like controls.",
      "Group secondary actions so the markup suggests a single dominant next step.",
    ],
    goal: "Reduce competing primary actions so the next step is clearer from early-page markup.",
    done_when: "Done when early-page markup presents one clear primary action and secondary CTAs are grouped or deferred.",
  },
};

export { wipMetadata };
