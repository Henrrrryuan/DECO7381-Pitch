function scHighlightRules({ SC_TEXT_BLOCK_TAGS }) {
  return {
    module_id: "SC-1",
    shouldReturnImmediatelyForMoreSpecificTarget: (tagNameLower) => SC_TEXT_BLOCK_TAGS.has(tagNameLower),
    validateTargetOverride: ({ location, tagNameLower, isGenericOrBadSelector }) => {
      if (SC_TEXT_BLOCK_TAGS.has(tagNameLower)) {
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
      summaryToSelector,
      findByText,
      filterScEvidenceElements,
      sortHighlightCandidates,
    }) => {
      if (location.cognilensId) {
        const scSel = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
        try {
          const matched = filterScEvidenceElements(Array.from(doc.querySelectorAll(scSel)));
          debugHighlight("SC-1 cognilensId lookup", location.cognilensId, "text-block matches", matched.length);
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("SC-1 cognilensId lookup failed", scSel, error);
        }
      }
      if (location.selector && !isGenericOrBadSelector(location.selector)) {
        try {
          const matched = filterScEvidenceElements(Array.from(doc.querySelectorAll(location.selector)));
          debugHighlight("SC-1 selector lookup", location.selector, "text-block matches", matched.length);
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("SC-1 selector lookup failed", location.selector, error);
        }
      }
      const scSummarySel = summaryToSelector(location.summary || location.region);
      if (scSummarySel) {
        try {
          const matched = filterScEvidenceElements(Array.from(doc.querySelectorAll(scSummarySel)));
          debugHighlight("SC-1 summary selector lookup", scSummarySel, "matches", matched.length);
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("SC-1 summary selector lookup failed", scSummarySel, error);
        }
      }
      const scTextKeys = ["text", "preview", "sentence_preview"];
      for (let ti = 0; ti < scTextKeys.length; ti += 1) {
        const tv = location[scTextKeys[ti]];
        if (tv) {
          const matched = filterScEvidenceElements(findByText(doc, location.tag, tv));
          debugHighlight(`SC-1 ${scTextKeys[ti]} fallback`, tv, "matches", matched.length);
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        }
      }
      return [];
    },
    fallbackSelectorsForIssueOverride: () => [],
  };
}

export { scHighlightRules };

