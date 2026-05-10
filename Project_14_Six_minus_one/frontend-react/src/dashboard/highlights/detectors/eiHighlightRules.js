function eiHighlightRules() {
  return {
    fallbackSelectorsForIssueOverride() {
      return [
        "dialog",
        "[role='dialog']",
        "[role='alertdialog']",
        "[aria-modal='true']",
        "[aria-live]",
        "[class*='modal' i]",
        "[class*='popup' i]",
        "[class*='overlay' i]",
        "[class*='toast' i]",
        "[class*='notification' i]",
        "[class*='sticky' i]",
        "[class*='chat' i]",
        "[class*='cookie' i]",
        "[class*='consent' i]",
      ];
    },
    validateTargetOverride() {
      return null;
    },
    moreSpecificTargetOverride() {
      return null;
    },
  };
}

export { eiHighlightRules };

