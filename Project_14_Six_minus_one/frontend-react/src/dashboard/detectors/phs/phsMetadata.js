const phsMetadata = {
  rule_id: "PHS-1",
  dimension: "Poor Heading Structure",
  frameworks: {
    coga: "COGA: Clear Navigation / Structure",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Clear Navigation / Structure",
  tooltip: {
    issue: "Heading hierarchy may make orientation harder.",
    impact: "h1–h6 hierarchy heuristic: missing h1, multiple h1, skipped levels, duplicate or empty headings, or no headings (not title tag or visual typography).",
  },
  guidance: {
    steps: [
      "Add one clear h1 that describes the page purpose.",
      "Use lower-level headings in order to mark major sections.",
    ],
    goal: "Create a predictable heading hierarchy.",
    done_when: "Done when headings follow a clear order from the main page heading down.",
  },
};

export { phsMetadata };

