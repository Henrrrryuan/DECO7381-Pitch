const scMetadata = {
  rule_id: "SC-1",
  dimension: "Sentence Complexity",
  frameworks: {
    coga: "COGA: Avoid Nested Clauses",
    iso: "ISO 9241-11: Efficiency",
    wcag: "WCAG SC 3.1.5 Reading Level (AAA)",
  },
  coga_objective: "Objective 3: Use clear and understandable content",
  tooltip: {
    issue: "Sentences may be too long or heavily connected.",
    impact: "We check sentence length, commas, and conjunctions.",
  },
  guidance: {
    steps: [
      "Split long sentences into shorter, direct statements.",
      "Keep each sentence focused on one main idea.",
    ],
    goal: "Make each sentence short enough to understand without re-reading.",
    done_when: "Done when each sentence communicates one idea without forcing re-reading.",
  },
};

export { scMetadata };

