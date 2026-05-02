import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  displayIssueCategoryName,
} from "../../utils/dashboard/dashboardLabels.js";
import {
  buildPreviewHtml,
  getFallbackSelectorsForIssue,
  getHighlightSettings,
  getPreviewFrameAddress,
} from "../../utils/dashboard/previewHighlight.js";
import {
  locationPrimaryText,
} from "../../utils/dashboard/issueGuidance.js";

function injectHighlightStyles(previewDocument) {
  if (!previewDocument || previewDocument.getElementById("cognilens-highlight-style")) {
    return;
  }

  const styleElement = previewDocument.createElement("style");
  styleElement.id = "cognilens-highlight-style";
  styleElement.textContent = `
    [data-cognilens-highlight] {
      position: relative !important;
      outline: 3px solid var(--cognilens-highlight-color, #2f6feb) !important;
      outline-offset: 5px !important;
      border-radius: 8px !important;
      background-color: color-mix(in srgb, var(--cognilens-highlight-color, #2f6feb) 10%, transparent) !important;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16) !important;
      transition: outline-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease !important;
    }

    [data-cognilens-highlight]::after {
      content: attr(data-cognilens-highlight);
      position: absolute;
      top: -18px;
      left: 10px;
      z-index: 2147483647;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--cognilens-highlight-color, #2f6feb);
      color: #fff;
      font: 700 11px/1.2 Arial, sans-serif;
      pointer-events: none;
    }
  `;
  previewDocument.head?.appendChild(styleElement);
}

function clearHighlights(previewDocument) {
  previewDocument?.querySelectorAll("[data-cognilens-highlight]").forEach((element) => {
    element.removeAttribute("data-cognilens-highlight");
    element.style.removeProperty("--cognilens-highlight-color");
  });
}

function normalizeInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findElementsByText(previewDocument, location) {
  const targetText = normalizeInlineText(locationPrimaryText(location));
  if (!targetText) {
    return [];
  }

  const selector = /^[a-z0-9-]+$/i.test(location?.tag || "") ? location.tag : "*";
  return Array.from(previewDocument.querySelectorAll(selector)).filter((element) => {
    const candidateText = normalizeInlineText(element.textContent);
    return candidateText.includes(targetText) || targetText.includes(candidateText);
  });
}

function findElementsForLocation(previewDocument, location) {
  if (!location || typeof location !== "object") {
    return [];
  }

  const selectorCandidates = [location.selector, location.summary, location.region]
    .filter((value) => value && !String(value).includes(" "));
  for (const selectorCandidate of selectorCandidates) {
    try {
      const matchedElements = Array.from(previewDocument.querySelectorAll(selectorCandidate));
      if (matchedElements.length) {
        return matchedElements;
      }
    } catch (_) {
      // Invalid selectors fall through to text matching.
    }
  }

  if (location.block_index) {
    const textBlocks = Array.from(previewDocument.querySelectorAll("p, li, article, section, blockquote, td, th"))
      .filter((element) => normalizeInlineText(element.textContent).length >= 20);
    const blockElement = textBlocks[Number(location.block_index) - 1];
    if (blockElement) {
      return [blockElement];
    }
  }

  return findElementsByText(previewDocument, location);
}

function collectFallbackElements(previewDocument, selectors) {
  return selectors.flatMap((selector) => {
    try {
      return Array.from(previewDocument.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  });
}

function applyHighlights(elements, color, label) {
  const highlightedElements = new Set();
  elements.forEach((element) => {
    if (!element || element.nodeType !== 1 || highlightedElements.size >= 30 || highlightedElements.has(element)) {
      return;
    }
    const elementRectangle = element.getBoundingClientRect();
    const tagName = element.tagName?.toLowerCase();
    if (
      elementRectangle.width < 24
      || elementRectangle.height < 14
      || ["br", "script", "style", "meta", "link"].includes(tagName)
    ) {
      return;
    }
    element.setAttribute("data-cognilens-highlight", label);
    element.style.setProperty("--cognilens-highlight-color", color);
    highlightedElements.add(element);
  });
  return highlightedElements;
}

export function WebsitePreviewPanel({
  currentDashboardItem,
  selectedIssueRecord,
  selectedDimensionName,
  onRenderedPreviewAvailable,
}) {
  // Website preview and highlight surface.
  //
  // DashboardWorkspace.jsx displays this component when a user asks to inspect
  // an issue on the page. It uses either a proxied URL or saved HTML content,
  // then applies the same data-cognilens-highlight attributes used by the old
  // dashboard.html implementation.
  const previewFrameReference = useRef(null);
  const [previewStatusMessage, setPreviewStatusMessage] = useState("Loading website preview...");
  const [previewHasError, setPreviewHasError] = useState(false);

  const sourceUrl = currentDashboardItem?.sourceUrl || "";
  const htmlContent = currentDashboardItem?.html || currentDashboardItem?.payload?.html_content || "";
  const previewFrameAddress = useMemo(() => getPreviewFrameAddress(sourceUrl), [sourceUrl]);
  const previewSourceDocument = useMemo(
    () => (previewFrameAddress ? "" : buildPreviewHtml(htmlContent)),
    [htmlContent, previewFrameAddress],
  );

  const highlightSelectedIssue = useCallback(() => {
    const previewDocument = previewFrameReference.current?.contentDocument
      || previewFrameReference.current?.contentWindow?.document
      || null;
    if (!previewDocument) {
      setPreviewStatusMessage("The website preview is still loading. Try again in a moment.");
      setPreviewHasError(true);
      return;
    }

    injectHighlightStyles(previewDocument);
    clearHighlights(previewDocument);

    if (!selectedIssueRecord && !selectedDimensionName) {
      setPreviewStatusMessage("Select a dimension or issue to highlight it in the preview.");
      setPreviewHasError(false);
      return;
    }

    if (!selectedIssueRecord && selectedDimensionName) {
      const highlightSettings = getHighlightSettings(selectedDimensionName);
      const highlightedElements = applyHighlights(
        collectFallbackElements(previewDocument, highlightSettings.selectors),
        highlightSettings.color,
        displayIssueCategoryName(selectedDimensionName),
      );
      const firstHighlightedElement = highlightedElements.values().next().value;
      firstHighlightedElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      if (highlightedElements.size) {
        setPreviewStatusMessage(`${highlightedElements.size} related area${highlightedElements.size === 1 ? "" : "s"} highlighted for ${displayIssueCategoryName(selectedDimensionName)}.`);
        setPreviewHasError(false);
      } else {
        setPreviewStatusMessage("No matching page element could be highlighted for this dimension.");
        setPreviewHasError(true);
      }
      return;
    }

    const { dimensionResult, issue } = selectedIssueRecord;
    const highlightSettings = getHighlightSettings(dimensionResult.dimension);
    const exactElements = (issue.locations || []).flatMap((location) => (
      findElementsForLocation(previewDocument, location)
    ));
    const fallbackElements = exactElements.length
      ? []
      : collectFallbackElements(previewDocument, getFallbackSelectorsForIssue(issue, dimensionResult.dimension));
    const highlightedElements = applyHighlights(
      exactElements.length ? exactElements : fallbackElements,
      highlightSettings.color,
      "Issue highlight",
    );

    const firstHighlightedElement = highlightedElements.values().next().value;
    firstHighlightedElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    if (highlightedElements.size) {
      const fallbackNotice = exactElements.length ? "" : " Related areas are highlighted because no exact selector was linked.";
      setPreviewStatusMessage(`${highlightedElements.size} area${highlightedElements.size === 1 ? "" : "s"} highlighted for ${issue.title || displayIssueCategoryName(dimensionResult.dimension)}.${fallbackNotice}`);
      setPreviewHasError(false);
    } else {
      setPreviewStatusMessage("No matching page element could be highlighted for this issue.");
      setPreviewHasError(true);
    }
  }, [selectedDimensionName, selectedIssueRecord]);

  const handlePreviewLoaded = useCallback(() => {
    const previewDocument = previewFrameReference.current?.contentDocument
      || previewFrameReference.current?.contentWindow?.document
      || null;
    if (!previewDocument) {
      setPreviewStatusMessage("The preview loaded, but the page document could not be inspected.");
      setPreviewHasError(true);
      return;
    }

    setPreviewStatusMessage("Preview loaded. Highlighting the selected issue.");
    setPreviewHasError(false);
    highlightSelectedIssue();

    if (sourceUrl) {
      const renderedHtml = previewDocument.documentElement?.outerHTML || "";
      if (renderedHtml.trim()) {
        onRenderedPreviewAvailable(renderedHtml);
      }
    }
  }, [highlightSelectedIssue, onRenderedPreviewAvailable, sourceUrl]);

  useEffect(() => {
    highlightSelectedIssue();
  }, [highlightSelectedIssue]);

  return (
    <div id="websiteView" className="workspace-view website-preview-view is-active">
      <p id="websitePreviewStatus" className={`visually-hidden${previewHasError ? " error" : ""}`} aria-live="polite">
        {previewStatusMessage}
      </p>
      <iframe
        id="websitePreviewFrame"
        className="website-preview-frame"
        ref={previewFrameReference}
        src={previewFrameAddress || undefined}
        srcDoc={previewFrameAddress ? undefined : previewSourceDocument}
        title="Analyzed website preview"
        onLoad={handlePreviewLoaded}
      />
    </div>
  );
}
