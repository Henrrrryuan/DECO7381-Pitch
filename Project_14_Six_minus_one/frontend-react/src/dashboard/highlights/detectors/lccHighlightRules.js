function lccHighlightRules() {
  return {
    module_id: "LCC-1",
    fallbackSelectorsForIssueOverride: () => ["p", "li", "article", "section", "label", "legend", "small"],
  };
}

export { lccHighlightRules };

