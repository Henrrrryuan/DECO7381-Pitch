function amcHighlightRules() {
  return {
    // Preserve existing AMC selector behavior from sharedHighlightRules.js exactly.
    fallbackSelectorsForIssueOverride() {
      return ["video[autoplay]", "audio[autoplay]", "iframe"];
    },
    // No overrides: preserve engine behavior.
    validateTargetOverride() {
      return null;
    },
    moreSpecificTargetOverride() {
      return null;
    },
  };
}

export { amcHighlightRules };

