const scMetadata = {
  rule_id: "SC-1",
  dimension: "Sentence Complexity",
  frameworks: {
    coga: "COGA: Use shorter, easier language",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 3.1.5 Reading Level (AAA)",
  },
  coga_objective: "Use Clear and Understandable Content",
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

