function dtHighlightRules({ DT_TEXT_BLOCK_TAGS }) {
  return {
    module_id: "DT-1",
    shouldReturnImmediatelyForMoreSpecificTarget: (tagNameLower) => DT_TEXT_BLOCK_TAGS.has(tagNameLower),
    validateTargetOverride: ({ element, location, tagNameLower, isGenericOrBadSelector }) => {
      // Mirror dashboardApp.js DT exemption: allow large DT blocks; still enforce non-generic selectors.
      if (DT_TEXT_BLOCK_TAGS.has(tagNameLower)) {
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
      filterDtEvidenceElements,
      sortHighlightCandidates,
      dt1FrontendForensicEnabled,
    }) => {
      let dtResolved = [];
      let dtStage = "unresolved";
      if (location.cognilensId) {
        const dtSel = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
        try {
          const matched = filterDtEvidenceElements(Array.from(doc.querySelectorAll(dtSel)));
          debugHighlight("DT-1 cognilensId lookup", location.cognilensId, "text-block matches", matched.length);
          if (matched.length) {
            dtResolved = sortHighlightCandidates(matched);
            dtStage = "cognilensId";
          }
        } catch (error) {
          debugHighlight("DT-1 cognilensId lookup failed", dtSel, error);
        }
      }
      if (!dtResolved.length && location.selector && !isGenericOrBadSelector(location.selector)) {
        try {
          const matched = filterDtEvidenceElements(Array.from(doc.querySelectorAll(location.selector)));
          debugHighlight("DT-1 selector lookup", location.selector, "text-block matches", matched.length);
          if (matched.length) {
            dtResolved = sortHighlightCandidates(matched);
            dtStage = "selector";
          }
        } catch (error) {
          debugHighlight("DT-1 selector lookup failed", location.selector, error);
          if (dt1FrontendForensicEnabled?.()) {
            const attrs = location.attrs || {};
            console.log("[DT-1 frontend]", {
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
      if (!dtResolved.length) {
        const dtSummarySel = summaryToSelector(location.summary || location.region);
        if (dtSummarySel) {
          try {
            const matched = filterDtEvidenceElements(Array.from(doc.querySelectorAll(dtSummarySel)));
            debugHighlight("DT-1 summary selector lookup", dtSummarySel, "matches", matched.length);
            if (matched.length) {
              dtResolved = sortHighlightCandidates(matched);
              dtStage = "summary";
            }
          } catch (error) {
            debugHighlight("DT-1 summary selector lookup failed", dtSummarySel, error);
          }
        }
      }
      if (!dtResolved.length) {
        const dtTextKeys = ["text", "preview", "sentence_preview"];
        for (let ti = 0; ti < dtTextKeys.length; ti += 1) {
          const tv = location[dtTextKeys[ti]];
          if (tv) {
            const matched = filterDtEvidenceElements(findByText(doc, location.tag, tv));
            debugHighlight(`DT-1 ${dtTextKeys[ti]} fallback`, tv, "matches", matched.length);
            if (matched.length) {
              dtResolved = sortHighlightCandidates(matched);
              dtStage = dtTextKeys[ti];
              break;
            }
          }
        }
      }
      if (dt1FrontendForensicEnabled?.()) {
        const attrs = location.attrs || {};
        console.log("[DT-1 frontend]", {
          stage: dtStage,
          caseId: attrs["data-case-id"] ?? attrs.dataCaseId ?? null,
          selector: location.selector,
          tag: location.tag,
          preview: location.preview,
          matched: dtResolved.length,
          finalTagName: dtResolved[0]?.tagName?.toLowerCase() ?? null,
        });
      }
      return dtResolved;
    },
    fallbackSelectorsForIssueOverride: () => [],
  };
}

export { dtHighlightRules };

