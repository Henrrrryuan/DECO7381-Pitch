function normalizeHeadingText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function narrowPhsHeadingsByLocationText(elements, location) {
  const target = normalizeHeadingText(location?.text || location?.preview || location?.label);
  if (!target) {
    return elements;
  }
  return elements.filter((element) => normalizeHeadingText(element.textContent) === target);
}

function phsHighlightRules() {
  return {
    module_id: "PHS-1",
    fallbackSelectorsForIssueOverride: () => [],
    resolveElementsForLocation: ({
      doc,
      location,
      cssEscape,
      sortHighlightCandidates,
      debugHighlight,
    }) => {
      if (!location || typeof location !== "object") {
        return [];
      }

      if (location.cognilensId) {
        const cognilensSelector = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
        try {
          const matched = Array.from(doc.querySelectorAll(cognilensSelector));
          debugHighlight("PHS-1 cognilensId lookup", location.cognilensId, "matches", matched.length);
          if (matched.length === 1) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("PHS-1 cognilensId lookup failed", cognilensSelector, error);
        }
      }

      if (location.selector) {
        try {
          let matched = Array.from(doc.querySelectorAll(location.selector));
          debugHighlight("PHS-1 selector lookup", location.selector, "matches", matched.length);
          if (matched.length > 1) {
            matched = narrowPhsHeadingsByLocationText(matched, location);
            debugHighlight("PHS-1 selector narrowed by text", location.selector, "matches", matched.length);
          }
          if (matched.length) {
            return sortHighlightCandidates(matched);
          }
        } catch (error) {
          debugHighlight("PHS-1 selector lookup failed", location.selector, error);
        }
      }

      const target = normalizeHeadingText(location.text || location.preview || location.label);
      if (target) {
        const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"];
        for (const tagName of headingTags) {
          const matched = Array.from(doc.querySelectorAll(tagName)).filter(
            (element) => normalizeHeadingText(element.textContent) === target,
          );
          if (matched.length === 1) {
            debugHighlight("PHS-1 heading text lookup", tagName, target, "matches", 1);
            return sortHighlightCandidates(matched);
          }
        }
      }

      return [];
    },
  };
}

export { phsHighlightRules };
