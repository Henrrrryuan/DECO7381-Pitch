const dtMetadata = {
  rule_id: "DT-1",
  dimension: "Dense Text Detection",
  frameworks: {
    coga: "COGA: Clear Language / Chunking",
    iso: "ISO 9241-11: Efficiency; Satisfaction",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Objective 3: Use clear and understandable content",
  tooltip: {
    issue: "Text blocks may be too dense to scan.",
    impact: "We check paragraph word count and sentence count.",
  },
  guidance: {
    steps: [
      "Break long paragraphs or list items into smaller chunks.",
      "Add subheadings, lists, or spacing so readers can scan before reading in full.",
    ],
    goal: "Turn dense text blocks into smaller, scannable chunks.",
    done_when: "Done when long text is split into shorter chunks with clear scan points.",
  },
};

export { dtMetadata };

