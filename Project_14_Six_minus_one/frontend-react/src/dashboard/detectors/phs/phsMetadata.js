const phsMetadata = {
  rule_id: "PHS-1",
  dimension: "Poor Heading Structure",
  frameworks: {
    coga: "COGA: Clear Navigation / Structure",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Objective 2: Help users find what they need",
  tooltip: {
    issue: "Semantic heading order may make page orientation harder.",
    impact: "h1–h6 markup-order heuristic: missing h1, multiple h1, skipped levels, duplicate or empty headings, or no headings; this does not evaluate visual size, styling, or viewport prominence.",
  },
  guidance: {
    steps: [
      "Use one clear semantic h1 where appropriate to describe the page purpose.",
      "Use h2–h6 in a predictable order to mark real sections, avoiding skipped levels, duplicates, and empty headings.",
    ],
    goal: "Create a predictable semantic h1–h6 structure.",
    done_when: "Done when heading markup follows a clear order and each heading communicates a section purpose.",
  },
};

export { phsMetadata };
