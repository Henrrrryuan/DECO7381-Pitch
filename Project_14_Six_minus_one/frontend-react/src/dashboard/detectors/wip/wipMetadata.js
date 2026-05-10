const wipMetadata = {
  rule_id: "WIP-1",
  dimension: "Weak Information Prominence",
  frameworks: {
    coga: "COGA: Make Important Tasks Easy to Find",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG SC 3.2.4 Consistent Identification; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Make Important Tasks Easy to Find",
  tooltip: {
    issue: "Many competing primary actions appear early in the page structure.",
    impact: "Early-page CTA density heuristic: multiple CTA-like controls in DOM order—not rendered salience or viewport analysis.",
  },
  guidance: {
    steps: [
      "Establish one clear primary action in the flow and demote or relocate competing CTAs.",
      "Group secondary actions so the markup suggests a single dominant next step.",
    ],
    goal: "Reduce competing primary actions so one next step reads clearly from structure.",
    done_when: "Done when early-page markup presents one clear primary action and secondary CTAs are grouped or deferred.",
  },
};

export { wipMetadata };

