const ncMetadata = {
  rule_id: "NC-1",
  dimension: "Navigation Complexity",
  frameworks: {
    coga: "COGA: Findable / Clear Navigation",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG SC 2.4.1 Bypass Blocks; SC 2.4.5 Multiple Ways",
  },
  coga_objective: "Objective 2: Help users find what they need",
  tooltip: {
    issue: "Navigation may create too many choices.",
    impact: "We check link count and nesting depth.",
  },
  guidance: {
    steps: [
      "Reduce the number of top-level navigation links.",
      "Flatten deeply nested menus and group related links clearly.",
    ],
    goal: "Make navigation choices easier to scan and understand.",
    done_when: "Done when navigation has fewer choices and shallow, clear grouping.",
  },
};

export { ncMetadata };

