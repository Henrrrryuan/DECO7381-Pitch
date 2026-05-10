function lcHighlightRules({ LC_TEXT_BLOCK_TAGS, lc1FrontendForensicEnabled }) {
  return {
    module_id: "LC-1",
    shouldReturnImmediatelyForMoreSpecificTarget: (tagNameLower) => LC_TEXT_BLOCK_TAGS.has(tagNameLower),
    validateTargetOverride: ({ location, tagNameLower, isGenericOrBadSelector }) => {
      if (LC_TEXT_BLOCK_TAGS.has(tagNameLower)) {
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
      filterLcEvidenceElements,
      sortHighlightCandidates,
    }) => {
      let lcResolved = [];
      let lcStage = "unresolved";
      if (location.cognilensId) {
        const lcSel = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
        try {
          const matched = filterLcEvidenceElements(Array.from(doc.querySelectorAll(lcSel)));
          debugHighlight("LC-1 cognilensId lookup", location.cognilensId, "matches", matched.length);
          if (matched.length) {
            lcResolved = sortHighlightCandidates(matched);
            lcStage = "cognilensId";
          }
        } catch (error) {
          debugHighlight("LC-1 cognilensId lookup failed", lcSel, error);
        }
      }
      if (!lcResolved.length && location.selector && !isGenericOrBadSelector(location.selector)) {
        try {
          const matched = filterLcEvidenceElements(Array.from(doc.querySelectorAll(location.selector)));
          debugHighlight("LC-1 selector lookup", location.selector, "matches", matched.length);
          if (matched.length) {
            lcResolved = sortHighlightCandidates(matched);
            lcStage = "selector";
          }
        } catch (error) {
          debugHighlight("LC-1 selector lookup failed", location.selector, error);
          if (lc1FrontendForensicEnabled?.()) {
            const attrs = location.attrs || {};
            console.log("[LC-1 frontend]", {
              stage: "selector_error",
              caseId: attrs["data-case-id"] ?? attrs.dataCaseId ?? null,
              selector: location.selector,
              tag: location.tag,
              preview: location.preview,
              matched: 0,
              finalTagName: null,
            });
          }
          return [];
        }
      }
      if (!lcResolved.length) {
        const lcSummarySel = summaryToSelector(location.summary || location.region);
        if (lcSummarySel) {
          try {
            const matched = filterLcEvidenceElements(Array.from(doc.querySelectorAll(lcSummarySel)));
            debugHighlight("LC-1 summary selector lookup", lcSummarySel, "matches", matched.length);
            if (matched.length) {
              lcResolved = sortHighlightCandidates(matched);
              lcStage = "summary";
            }
          } catch (error) {
            debugHighlight("LC-1 summary selector lookup failed", lcSummarySel, error);
          }
        }
      }
      if (!lcResolved.length) {
        const lcTextKeys = ["text", "preview"];
        for (let ti = 0; ti < lcTextKeys.length; ti += 1) {
          const tv = location[lcTextKeys[ti]];
          if (tv) {
            const matched = filterLcEvidenceElements(findByText(doc, location.tag, tv));
            debugHighlight(`LC-1 ${lcTextKeys[ti]} fallback`, tv, "matches", matched.length);
            if (matched.length) {
              lcResolved = sortHighlightCandidates(matched);
              lcStage = lcTextKeys[ti];
              break;
            }
          }
        }
      }
      if (lc1FrontendForensicEnabled?.()) {
        const attrs = location.attrs || {};
        console.log("[LC-1 frontend]", {
          stage: lcStage,
          caseId: attrs["data-case-id"] ?? attrs.dataCaseId ?? null,
          selector: location.selector,
          tag: location.tag,
          preview: location.preview,
          matched: lcResolved.length,
          finalTagName: lcResolved[0]?.tagName?.toLowerCase() ?? null,
        });
      }
      return lcResolved;
    },
    fallbackSelectorsForIssueOverride: () => [],
  };
}

export { lcHighlightRules };

