import { defaultFallbackSelectorsForIssue, logHighlightEngine } from "../rules/sharedHighlightRules.js";
import { getHighlightRules } from "../registry/highlightRuleRegistry.js";

function validateHighlightTargetEngine(ctx, element, location = null, frameDoc = null, ruleIdHint = "") {
  if (!element || element.nodeType !== 1) {
    return { ok: false, reason: "No visible target found" };
  }
  const tagName = element.tagName?.toLowerCase();
  const effectiveRuleId = location?.rule_id || ruleIdHint || "";
  if (["html", "head", "body", "script", "style", "meta", "link", "noscript", "template", "defs", "path"].includes(tagName)) {
    return { ok: false, reason: `Bad target tag: ${tagName}` };
  }
  const hiddenReason = ctx.elementHiddenReason(element);
  if (hiddenReason) {
    return { ok: false, reason: hiddenReason };
  }

  const rules = getHighlightRules(effectiveRuleId, ctx.ruleContext || {});
  const override = rules?.validateTargetOverride?.({
    element,
    location,
    tagNameLower: tagName,
    isGenericOrBadSelector: ctx.isGenericOrBadSelector,
  });
  if (override) {
    return override;
  }

  const rect = element.getBoundingClientRect();
  const viewportWidth = frameDoc?.documentElement?.clientWidth || element.ownerDocument?.documentElement?.clientWidth || 0;
  const viewportHeight = frameDoc?.documentElement?.clientHeight || element.ownerDocument?.documentElement?.clientHeight || 0;
  if (viewportWidth && viewportHeight && rect.width * rect.height > viewportWidth * viewportHeight * 0.6) {
    return { ok: false, reason: "Target is a large structural container" };
  }
  if (location?.selector && ctx.isGenericOrBadSelector(location.selector)) {
    return { ok: false, reason: `Selector is too broad: ${location.selector}` };
  }
  return { ok: true, reason: "" };
}

function moreSpecificHighlightTargetEngine(ctx, element, location = null, frameDoc = null, ruleId = "") {
  const rid = ruleId || location?.rule_id || "";
  const elTag = element?.tagName?.toLowerCase();
  const rules = getHighlightRules(rid, ctx.ruleContext || {});
  if (rules?.shouldReturnImmediatelyForMoreSpecificTarget?.(elTag)) {
    return element;
  }
  const validation = validateHighlightTargetEngine(ctx, element, location, frameDoc, rid);
  if (validation.ok) {
    return element;
  }
  const childSelectors = "a, button, input, select, textarea, img, h1, h2, h3, h4, p, li, video, audio, iframe, [role='button']";
  const children = Array.from(element?.querySelectorAll?.(childSelectors) || []);
  const child = ctx.sortHighlightCandidates(children).find((candidate) => (
    validateHighlightTargetEngine(ctx, candidate, null, frameDoc, "").ok
  ));
  if (child) {
    ctx.debugHighlight("using more specific child target", {
      originalReason: validation.reason,
      originalTag: element?.tagName?.toLowerCase(),
      childTag: child.tagName?.toLowerCase(),
      childText: ctx.elementTextPreview(child),
    });
    return child;
  }
  return element;
}

function findElementsForLocationEngine(ctx, doc, location, ruleId = "") {
  if (!location || typeof location !== "object") {
    return [];
  }
  if (location.highlightable === false || location.documentStructuralFinding === true) {
    return [];
  }

  const effectiveRuleId = ruleId || location.rule_id || "";
  const rules = getHighlightRules(effectiveRuleId, ctx.ruleContext || {});
  if (rules?.resolveElementsForLocation) {
    const resolved = rules.resolveElementsForLocation({
      doc,
      location,
      cssEscape: ctx.cssEscape,
      debugHighlight: ctx.debugHighlight,
      isGenericOrBadSelector: ctx.isGenericOrBadSelector,
      summaryToSelector: ctx.summaryToSelector,
      findByText: ctx.findByText,
      filterDtEvidenceElements: ctx.filterDtEvidenceElements,
      filterScEvidenceElements: ctx.filterScEvidenceElements,
      filterLcEvidenceElements: ctx.filterLcEvidenceElements,
      sortHighlightCandidates: ctx.sortHighlightCandidates,
      lc1FrontendForensicEnabled: ctx.lc1FrontendForensicEnabled,
      dt1FrontendForensicEnabled: ctx.dt1FrontendForensicEnabled,
    });
    return Array.isArray(resolved) ? resolved : [];
  }

  if (location.cognilensId) {
    const selector = `[data-cognilens-id="${ctx.cssEscape(location.cognilensId)}"]`;
    const matched = Array.from(doc.querySelectorAll(selector));
    ctx.debugHighlight("cognilensId lookup", location.cognilensId, "matches", matched.length);
    if (matched.length) {
      return ctx.sortHighlightCandidates(matched);
    }
  }

  if (location.selector) {
    if (ctx.isGenericOrBadSelector(location.selector)) {
      ctx.debugHighlight("skip broad/bad selector", location.selector);
    } else {
      try {
        const matched = Array.from(doc.querySelectorAll(location.selector));
        ctx.debugHighlight("selector lookup", location.selector, "matches", matched.length);
        ctx.debugCandidateList(`selector ${location.selector}`, matched, doc);
        if (matched.length) {
          return ctx.sortHighlightCandidates(matched);
        }
      } catch (error) {
        ctx.debugHighlight("selector lookup failed", location.selector, error);
        return [];
      }
    }
  }

  const summarySelector = ctx.summaryToSelector(location.summary || location.region);
  if (summarySelector) {
    try {
      const matched = Array.from(doc.querySelectorAll(summarySelector));
      ctx.debugHighlight("summary selector lookup", summarySelector, "matches", matched.length);
      ctx.debugCandidateList(`summary selector ${summarySelector}`, matched, doc);
      if (matched.length) {
        return ctx.sortHighlightCandidates(matched);
      }
    } catch (error) {
      // fall through
    }
  }

  if (location.block_index) {
    const block = ctx.collectTextBlocks(doc)[Number(location.block_index) - 1];
    if (block) {
      return [block];
    }
  }

  if (location.text) {
    const matched = ctx.findByText(doc, location.tag, location.text);
    ctx.debugHighlight("text fallback", location.text, "matches", matched.length);
    ctx.debugCandidateList("text fallback", matched, doc);
    if (matched.length) {
      return ctx.sortHighlightCandidates(matched);
    }
  }

  if (location.preview) {
    const matched = ctx.findByText(doc, location.tag, location.preview);
    ctx.debugHighlight("preview fallback", location.preview, "matches", matched.length);
    ctx.debugCandidateList("preview fallback", matched, doc);
    if (matched.length) {
      return ctx.sortHighlightCandidates(matched);
    }
  }

  if (location.sentence_preview) {
    const matched = ctx.findByText(doc, location.tag, location.sentence_preview);
    ctx.debugHighlight("sentence preview fallback", location.sentence_preview, "matches", matched.length);
    ctx.debugCandidateList("sentence preview fallback", matched, doc);
    if (matched.length) {
      return ctx.sortHighlightCandidates(matched);
    }
  }

  if (location.label || location.summary) {
    const text = location.label || location.summary;
    const matched = ctx.findByText(doc, location.tag, text);
    ctx.debugHighlight("label/summary fallback", text, "matches", matched.length);
    ctx.debugCandidateList("label/summary fallback", matched, doc);
    if (matched.length) {
      return ctx.sortHighlightCandidates(matched);
    }
  }

  return [];
}

function fallbackSelectorsForIssueEngine(ctx, issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const rules = getHighlightRules(ruleId, ctx.ruleContext || {});
  if (rules?.fallbackSelectorsForIssueOverride) {
    return rules.fallbackSelectorsForIssueOverride(issue, dimensionName);
  }
  return defaultFallbackSelectorsForIssue(issue, dimensionName, ctx.HIGHLIGHT_CONFIG);
}

function logHighlightResolution(ctx, { ruleId, selector, matched, finalTarget }) {
  const rules = getHighlightRules(ruleId, ctx.ruleContext || {});
  logHighlightEngine({
    rule_id: ruleId,
    semantic_module: ctx.getDetectorSemanticModule ? (ctx.getDetectorSemanticModule(ruleId) ? ruleId : null) : null,
    highlight_rule_module: rules?.module_id || null,
    selector: selector || "",
    matched_count: Array.isArray(matched) ? matched.length : 0,
    final_target_tag: finalTarget?.tagName?.toLowerCase?.() || "",
  });
}

export {
  fallbackSelectorsForIssueEngine,
  findElementsForLocationEngine,
  logHighlightResolution,
  moreSpecificHighlightTargetEngine,
  validateHighlightTargetEngine,
};

