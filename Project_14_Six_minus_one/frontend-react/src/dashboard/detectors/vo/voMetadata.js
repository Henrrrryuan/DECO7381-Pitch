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
    issue: "Many elements or controls may appear early in the page markup.",
    impact: "We use an early-page structural density heuristic based on DOM elements and interactive counts; this is not a full rendered visual-salience analysis.",
  },
  guidance: {
    steps: [
      "Reduce the number of elements and controls that appear early in the page markup.",
      "Group related content so users can identify the main task and decide where to focus first.",
    ],
    goal: "Reduce early-page structural density so users encounter fewer competing regions and controls at the start of the page.",
    done_when: "Done when early-page markup has fewer competing elements and clearer grouping around the main task.",
  },
};

export { voMetadata };
