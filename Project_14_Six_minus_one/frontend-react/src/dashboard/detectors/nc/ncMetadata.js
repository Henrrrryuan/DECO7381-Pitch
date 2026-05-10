const ncMetadata = {
  rule_id: "NC-1",
  dimension: "Navigation Complexity",
  frameworks: {
    coga: "COGA: Predictable navigation cues",
    iso: "ISO 9241-11:2018 6.3.2 Time used; 6.3.3 Human effort expended",
    wcag: "WCAG SC 2.4.1 Bypass Blocks; SC 2.4.5 Multiple Ways",
  },
  coga_objective: "Help Users Find What They Need",
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

