function ncHighlightRules() {
  return {
    module_id: "NC-1",
    shouldReturnImmediatelyForMoreSpecificTarget: (tagNameLower) => tagNameLower === "nav",
    validateTargetOverride: ({ location, tagNameLower, isGenericOrBadSelector }) => {
      if (tagNameLower === "nav") {
        if (location?.selector && isGenericOrBadSelector(location.selector)) {
          return { ok: false, reason: `Selector is too broad: ${location.selector}` };
        }
        return { ok: true, reason: "" };
      }
      return null;
    },
    resolveElementsForLocation: ({
      doc,
      location,
      cssEscape,
      debugHighlight,
      isGenericOrBadSelector,
      sortHighlightCandidates,
    }) => {
      if (location.cognilensId) {
        const ncSelector = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
        try {
          const matched = Array.from(doc.querySelectorAll(ncSelector)).filter(
            (el) => el.tagName?.toLowerCase() === "nav",
          );
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("NC-1 cognilensId lookup failed", ncSelector, error);
        }
      }
      if (location.selector && !isGenericOrBadSelector(location.selector)) {
        try {
          const matched = Array.from(doc.querySelectorAll(location.selector)).filter(
            (el) => el.tagName?.toLowerCase() === "nav",
          );
          debugHighlight("NC-1 selector lookup", location.selector, "nav matches", matched.length);
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("NC-1 selector lookup failed", location.selector, error);
        }
      }
      return [];
    },
    fallbackSelectorsForIssueOverride: () => [],
  };
}

export { ncHighlightRules };

