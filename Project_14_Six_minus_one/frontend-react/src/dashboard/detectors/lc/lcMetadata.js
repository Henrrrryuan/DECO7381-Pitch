const lcMetadata = {
  rule_id: "LC-1",
  dimension: "Language Complexity",
  frameworks: {
    coga: "COGA: Use Clear Words",
    iso: "ISO 9241-11: Efficiency",
    wcag: "WCAG SC 3.1.3 Unusual Words; SC 3.1.5 Reading Level (AAA)",
  },
  coga_objective: "Objective 3: Use clear and understandable content",
  tooltip: {
    issue: "Some text blocks may have a high lexical complexity estimate.",
    impact: "We use a complex-word ratio heuristic; this is not a full reading-level or vocabulary familiarity assessment.",
  },
  guidance: {
    steps: [
      "Review words flagged by the complex-word ratio heuristic and replace avoidable dense wording with clearer terms.",
      "Keep necessary specialist terms, but explain them briefly near where they appear.",
    ],
    goal: "Reduce lexical complexity where simpler wording would preserve meaning.",
    done_when: "Done when important terms are either simplified, necessary, or briefly explained.",
  },
};

export { lcMetadata };
