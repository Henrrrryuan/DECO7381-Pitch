const lccMetadata = {
  rule_id: "LCC-1",
  dimension: "Long Content Without Chunking",
  frameworks: {
    coga: "COGA: Support scanning with chunking",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  coga_objective: "Use Clear and Understandable Content",
  tooltip: {
    issue: "Long sections may lack structure.",
    impact: "We check long main/article/section content without headings or lists.",
  },
  guidance: {
    steps: [
      "Break long prose into smaller grouped chunks.",
      "Use lists, short sub-sections, or clearly separated steps to reduce scanning effort.",
    ],
    goal: "Break long content into clear sections that users can scan.",
    done_when: "Done when users can scan section headings or chunks before reading in full.",
  },
};

export { lccMetadata };

