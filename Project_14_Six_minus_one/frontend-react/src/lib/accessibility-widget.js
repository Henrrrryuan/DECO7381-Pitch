import {
  ACCESSIBILITY_CHEVRON_ICON,
  ACCESSIBILITY_CLOSE_ICON,
  ACCESSIBILITY_MAIN_OPTIONS,
  ACCESSIBILITY_MENU_FEATURES,
  ACCESSIBILITY_PERSON_ICON,
  ACCESSIBILITY_PROFILE_OPTIONS,
  ACCESSIBILITY_RESTORE_ICON,
  ACCESSIBILITY_SPIN_DURATION_MS,
  restoreAccessibilityDefaults,
  runAccessibilityMenuFeature,
} from "./accessibility-menu-features.js";

function createAccessibilityWidget() {
  if (document.querySelector(".accessibility-widget-button, .accessibility-menu")) {
    return;
  }

  const ACCESSIBILITY_MENU_FADE_DURATION_MS = 840;
  const button = document.createElement("button");
  const activeOptionIds = new Set();
  const activeProfileIds = new Set();
  const readingMaskFrameCleanupByFrame = new WeakMap();
  const outsideClickFrameCleanupByFrame = new WeakMap();
  const bigCursorFrameCleanupByFrame = new WeakMap();
  let menuCloseTimer = 0;
  let textReaderSelection = null;
  let saturationMode = "default";
  const BIG_CURSOR_FRAME_STYLE_ID = "cognilens-accessibility-big-cursor-style";
  const BIG_CURSOR_DEFAULT_URL = "https://img.icons8.com/ios/100/cursor--v1.png";
  const BIG_CURSOR_POINTER_URL = "https://img.icons8.com/?size=100&id=37397&format=png&color=000000";
  button.className = "accessibility-widget-button";
  button.type = "button";
  button.setAttribute("aria-label", "Open accessibility menu");
  button.setAttribute("aria-controls", "accessibilityMenu");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `
    <span class="accessibility-widget-ring">
      ${ACCESSIBILITY_PERSON_ICON}
    </span>
  `;

  const menu = document.createElement("aside");
  const readingMask = document.createElement("div");
  const tooltip = document.createElement("div");
  menu.id = "accessibilityMenu";
  menu.className = "accessibility-menu";
  menu.setAttribute("aria-label", "Accessibility Menu");
  menu.hidden = true;
  menu.innerHTML = `
    <header class="accessibility-menu-header">
      <h2>Accessibility Menu</h2>
      <button class="accessibility-menu-close" type="button" aria-label="Close accessibility menu">
        ${ACCESSIBILITY_CLOSE_ICON}
      </button>
    </header>
    <div class="accessibility-menu-sections">
      ${ACCESSIBILITY_MENU_FEATURES.map((section) => `
        <div class="accessibility-menu-section">
          <button
            class="accessibility-menu-row"
            type="button"
            data-accessibility-feature="${section.id}"
            ${section.tooltip ? `data-accessibility-tooltip="${section.tooltip}"` : ""}
            ${section.id === "main-options" || section.id === "profiles" ? 'aria-expanded="false"' : ""}
          >
            <span class="accessibility-menu-row-icon">${section.icon}</span>
            <span class="accessibility-menu-row-label">${section.label}</span>
            ${section.extraHtml || ""}
            <span class="accessibility-menu-chevron">${ACCESSIBILITY_CHEVRON_ICON}</span>
          </button>
          ${section.id === "profiles" ? `
            <div class="accessibility-profile-options-grid" hidden>
              ${ACCESSIBILITY_PROFILE_OPTIONS.map((profile) => `
                <button
                  class="accessibility-profile-card"
                  type="button"
                  data-accessibility-profile="${profile.id}"
                  aria-pressed="false"
                >
                  <span class="accessibility-profile-icon">${profile.icon}</span>
                  <span class="accessibility-profile-label">${profile.label}</span>
                </button>
              `).join("")}
            </div>
          ` : ""}
          ${section.id === "main-options" ? `
            <div class="accessibility-main-options-grid" hidden>
              ${ACCESSIBILITY_MAIN_OPTIONS.map((option) => `
                <button
                  class="accessibility-option-card"
                  type="button"
                  aria-pressed="false"
                  data-accessibility-option="${option.id}"
                  data-default-label="${option.label}"
                  data-active-label="${option.activeLabel || option.label}"
                >
                  <span class="accessibility-option-icon">${option.icon}</span>
                  <span class="accessibility-option-label">${option.label}</span>
                  ${option.levels ? `
                    <span class="accessibility-option-levels" aria-hidden="true">
                      ${Array.from({ length: option.levels }).map(() => "<span></span>").join("")}
                    </span>
                  ` : ""}
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
      `).join("")}
    </div>
    <section class="accessibility-page-structure" hidden>
      <header class="accessibility-page-structure-header">
        <button class="accessibility-page-structure-back" type="button" aria-label="Back to accessibility menu">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" />
          </svg>
        </button>
        <h2>Page Structure</h2>
      </header>
      <div class="accessibility-page-structure-tabs" role="tablist" aria-label="Page structure categories">
        <button class="is-active" type="button" role="tab" aria-selected="true" data-page-structure-tab="headings">
          <span aria-hidden="true">H</span>
          Heading
        </button>
        <button type="button" role="tab" aria-selected="false" data-page-structure-tab="landmarks">
          <span aria-hidden="true">▦</span>
          Landmarks
        </button>
        <button type="button" role="tab" aria-selected="false" data-page-structure-tab="links">
          <span aria-hidden="true">⌁</span>
          Links
        </button>
      </div>
      <div class="accessibility-page-structure-note">
        <span aria-hidden="true">i</span>
        <p></p>
      </div>
      <div class="accessibility-page-structure-list" role="list"></div>
    </section>
    <footer class="accessibility-menu-footer">
      <strong class="accessibility-menu-brand">CogniLens</strong>
      <button class="accessibility-restore-button" type="button">
        ${ACCESSIBILITY_RESTORE_ICON}
        Restore Default
      </button>
    </footer>
  `;
  readingMask.className = "accessibility-reading-mask";
  readingMask.setAttribute("aria-hidden", "true");
  readingMask.innerHTML = `
    <span class="accessibility-reading-mask-top"></span>
    <span class="accessibility-reading-mask-band"></span>
    <span class="accessibility-reading-mask-bottom"></span>
  `;
  tooltip.className = "accessibility-tooltip-bubble";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;

  function closeMenu() {
    window.clearTimeout(menuCloseTimer);
    menu.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    menuCloseTimer = window.setTimeout(() => {
      menu.hidden = true;
      button.hidden = false;
    }, ACCESSIBILITY_MENU_FADE_DURATION_MS);
  }

  function closeMenuAfterOutsidePointer(event) {
    if (menu.hidden || !menu.classList.contains("is-open")) {
      return;
    }
    const eventTarget = event.target;
    if (menu.contains(eventTarget) || button.contains(eventTarget)) {
      return;
    }
    closeMenu();
  }

  function closeMenuFromFramePointer() {
    if (menu.hidden || !menu.classList.contains("is-open")) {
      return;
    }
    closeMenu();
  }

  function bindOutsideClickFrameDocument(frameElement) {
    const previousCleanup = outsideClickFrameCleanupByFrame.get(frameElement);
    if (previousCleanup) {
      previousCleanup();
      outsideClickFrameCleanupByFrame.delete(frameElement);
    }

    let frameDocument = null;
    try {
      frameDocument = frameElement.contentDocument || frameElement.contentWindow?.document || null;
    } catch {
      frameDocument = null;
    }

    if (!frameDocument) {
      return;
    }

    frameDocument.addEventListener("pointerdown", closeMenuFromFramePointer, true);

    outsideClickFrameCleanupByFrame.set(frameElement, () => {
      frameDocument.removeEventListener("pointerdown", closeMenuFromFramePointer, true);
    });
  }

  function attachOutsideClickFrameListener(frameElement) {
    bindOutsideClickFrameDocument(frameElement);
    if (frameElement.dataset.accessibilityOutsideClickLoadBound === "true") {
      return;
    }
    frameElement.dataset.accessibilityOutsideClickLoadBound = "true";
    frameElement.addEventListener("load", () => {
      bindOutsideClickFrameDocument(frameElement);
    });
  }

  function syncOutsideClickFrameListeners() {
    document.querySelectorAll("iframe").forEach((frameElement) => {
      attachOutsideClickFrameListener(frameElement);
    });
  }

  function setReadingMaskActive(isActive) {
    document.body.classList.toggle("accessibility-reading-mask-active", isActive);
    if (!isActive) {
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
      return;
    }
    setReadingMaskPositionY(window.innerHeight * 0.5);
    syncReadingMaskFrameListeners();
  }

  function setBigCursorActive(isActive) {
    document.body.classList.toggle("accessibility-big-cursor-enabled", isActive);
    if (isActive) {
      syncBigCursorFrameStyles();
    } else {
      clearBigCursorFrameStyles();
    }
  }

  function setReadableFontsActive(isActive) {
    document.body.classList.toggle("accessibility-readable-fonts-enabled", isActive);
  }

  function clearTextReaderSelection() {
    textReaderSelection?.classList.remove("accessibility-text-reader-selection");
    textReaderSelection = null;
  }

  function setTextReaderActive(isActive) {
    document.body.classList.toggle("accessibility-text-reader-enabled", isActive);
    if (!isActive) {
      clearTextReaderSelection();
    }
  }

  function setSaturationMode(nextSaturationMode) {
    saturationMode = nextSaturationMode;
    document.body.classList.toggle("accessibility-saturation-low", saturationMode === "low");
    document.body.classList.toggle("accessibility-saturation-high", saturationMode === "high");
  }

  function getBigCursorFrameCss() {
    return `
      html,
      body,
      body * {
        cursor: url("${BIG_CURSOR_DEFAULT_URL}") 10 4, auto !important;
      }

      a,
      button,
      [role="button"],
      input[type="button"],
      input[type="submit"],
      input[type="reset"],
      label,
      summary,
      select,
      [onclick],
      [tabindex]:not([tabindex="-1"]) {
        cursor: url("${BIG_CURSOR_POINTER_URL}") 20 6, pointer !important;
      }
    `;
  }

  function getFrameDocument(frameElement) {
    try {
      return frameElement.contentDocument || frameElement.contentWindow?.document || null;
    } catch {
      return null;
    }
  }

  function injectBigCursorFrameStyle(frameElement) {
    const frameDocument = getFrameDocument(frameElement);
    if (!frameDocument) {
      return;
    }
    const frameHead = frameDocument.head || frameDocument.documentElement;
    if (!frameHead) {
      return;
    }
    let styleElement = frameDocument.getElementById(BIG_CURSOR_FRAME_STYLE_ID);
    if (!styleElement) {
      styleElement = frameDocument.createElement("style");
      styleElement.id = BIG_CURSOR_FRAME_STYLE_ID;
      frameHead.appendChild(styleElement);
    }
    styleElement.textContent = getBigCursorFrameCss();
  }

  function removeBigCursorFrameStyle(frameElement) {
    const frameDocument = getFrameDocument(frameElement);
    frameDocument?.getElementById(BIG_CURSOR_FRAME_STYLE_ID)?.remove();
  }

  function attachBigCursorFrameStyle(frameElement) {
    injectBigCursorFrameStyle(frameElement);
    if (bigCursorFrameCleanupByFrame.has(frameElement)) {
      return;
    }
    const reapplyBigCursorFrameStyle = () => {
      if (document.body.classList.contains("accessibility-big-cursor-enabled")) {
        injectBigCursorFrameStyle(frameElement);
      }
    };
    frameElement.addEventListener("load", reapplyBigCursorFrameStyle);
    bigCursorFrameCleanupByFrame.set(frameElement, () => {
      frameElement.removeEventListener("load", reapplyBigCursorFrameStyle);
      removeBigCursorFrameStyle(frameElement);
    });
  }

  function syncBigCursorFrameStyles() {
    document.querySelectorAll("iframe").forEach((frameElement) => {
      attachBigCursorFrameStyle(frameElement);
    });
  }

  function clearBigCursorFrameStyles() {
    document.querySelectorAll("iframe").forEach((frameElement) => {
      removeBigCursorFrameStyle(frameElement);
    });
  }

  function setStopAnimationActive(isActive) {
    document.body.classList.toggle("accessibility-stop-animation-enabled", isActive);
  }

  function setHighlightLinksActive(isActive) {
    document.body.classList.toggle("accessibility-highlight-links-enabled", isActive);
  }

  function setHighlightTitlesActive(isActive) {
    document.body.classList.toggle("accessibility-highlight-titles-enabled", isActive);
  }

  function setTooltipsActive(isActive) {
    document.body.classList.toggle("accessibility-tooltips-enabled", isActive);
    if (!isActive) {
      hideAccessibilityTooltip();
    }
  }

  function isTextReaderIgnoredElement(element) {
    return Boolean(element.closest(
      ".accessibility-menu, .accessibility-widget-button, .accessibility-tooltip-bubble, button, a, input, textarea, select, option, label, summary, [role='button'], [contenteditable='true']",
    ));
  }

  function getTextReaderTarget(eventTarget) {
    if (!(eventTarget instanceof Element) || isTextReaderIgnoredElement(eventTarget)) {
      return null;
    }

    const textElement = eventTarget.closest(
      "p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dd, dt, td, th, article, section, span",
    );
    if (!textElement || isTextReaderIgnoredElement(textElement)) {
      return null;
    }

    const textContent = textElement.textContent?.replace(/\s+/g, " ").trim() || "";
    if (textContent.length < 2) {
      return null;
    }

    return textElement;
  }

  function selectTextReaderTarget(targetElement) {
    if (!document.body.classList.contains("accessibility-text-reader-enabled")) {
      return;
    }

    if (!targetElement) {
      clearTextReaderSelection();
      return;
    }

    clearTextReaderSelection();
    textReaderSelection = targetElement;
    textReaderSelection.classList.add("accessibility-text-reader-selection");
  }

  function getStructureText(element, fallback = "Untitled") {
    const explicitLabel = element.getAttribute("aria-label")
      || element.getAttribute("title")
      || element.querySelector("h1, h2, h3, h4, h5, h6")?.textContent;
    const text = explicitLabel || element.textContent || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 120) || fallback;
  }

  function getLandmarkText(element, fallback = "Untitled") {
    const explicitLabel = element.getAttribute("aria-label")
      || element.getAttribute("title")
      || element.querySelector("h1, h2, h3, h4, h5, h6")?.textContent;
    return (explicitLabel || fallback).replace(/\s+/g, " ").trim().slice(0, 120) || fallback;
  }

  function isStructureElementVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.closest(".accessibility-menu, .accessibility-widget-button, .accessibility-tooltip-bubble")) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  }

  function getLandmarkName(element) {
    const role = element.getAttribute("role")?.toLowerCase() || "";
    const tagName = element.tagName.toLowerCase();
    const landmarkTypeByRole = {
      banner: "Banner",
      navigation: "Navigation",
      main: "Main",
      contentinfo: "Footer",
      complementary: "Complementary",
      search: "Search",
      form: "Form",
      region: "Region",
      tablist: "Tabpanel",
    };
    const landmarkTypeByTag = {
      header: "Banner",
      nav: "Navigation",
      main: "Main",
      footer: "Footer",
      aside: "Complementary",
      section: "Region",
      article: "Region",
      form: "Form",
    };
    const landmarkType = landmarkTypeByRole[role] || landmarkTypeByTag[tagName] || "Region";
    return `${landmarkType}: ${getLandmarkText(element, landmarkType)}`;
  }

  function getStructureDepth(element) {
    return Math.min(4, element.parentElement?.closest("main, header, nav, footer, aside, section, article, [role]") ? 1 : 0);
  }

  function collectPageStructureItems(activeTab) {
    if (activeTab === "headings") {
      return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
        .filter(isStructureElementVisible)
        .map((element) => ({
          element,
          label: getStructureText(element, "Untitled heading"),
          marker: element.tagName.toUpperCase(),
          depth: Math.max(0, Number(element.tagName.slice(1)) - 1),
        }));
    }

    if (activeTab === "links") {
      return Array.from(document.querySelectorAll("a[href]"))
        .filter(isStructureElementVisible)
        .map((element) => ({
          element,
          label: getStructureText(element, element.getAttribute("href") || "Link"),
          marker: "⌁",
          depth: 0,
        }));
    }

    return Array.from(document.querySelectorAll("header, nav, main, footer, aside, section, article, form, [role='banner'], [role='navigation'], [role='main'], [role='contentinfo'], [role='complementary'], [role='search'], [role='form'], [role='region'], [role='tablist']"))
      .filter(isStructureElementVisible)
      .map((element) => ({
        element,
        label: getLandmarkName(element),
        marker: "▦",
        depth: getStructureDepth(element),
      }));
  }

  function getPageStructureDescription(activeTab) {
    if (activeTab === "links") {
      return "Highlights key links on the site for quick and easy access to important sections.";
    }
    if (activeTab === "landmarks") {
      return "Divides the page into regions like headers and navigation, making it easier for assistive tools to guide users.";
    }
    return "Provides an overview of the website's layout, helping users navigate key sections with ease.";
  }

  function scrollToStructureElement(element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("accessibility-page-structure-target");
    window.setTimeout(() => {
      element.classList.remove("accessibility-page-structure-target");
    }, 1800);
  }

  function renderPageStructure(activeTab = "headings") {
    const structureView = menu.querySelector(".accessibility-page-structure");
    const structureList = menu.querySelector(".accessibility-page-structure-list");
    const structureNote = menu.querySelector(".accessibility-page-structure-note p");
    if (!structureView || !structureList || !structureNote) {
      return;
    }

    menu.querySelectorAll("[data-page-structure-tab]").forEach((tabButton) => {
      const isActive = tabButton.dataset.pageStructureTab === activeTab;
      tabButton.classList.toggle("is-active", isActive);
      tabButton.setAttribute("aria-selected", String(isActive));
    });

    structureNote.textContent = getPageStructureDescription(activeTab);
    structureList.innerHTML = "";

    const items = collectPageStructureItems(activeTab);
    if (!items.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "accessibility-page-structure-empty";
      emptyState.textContent = "No matching page structure items found.";
      structureList.appendChild(emptyState);
      return;
    }

    items.forEach((item) => {
      const itemButton = document.createElement("button");
      itemButton.className = "accessibility-page-structure-item";
      itemButton.type = "button";
      itemButton.style.setProperty("--structure-depth", String(item.depth));
      itemButton.innerHTML = `
        <span class="accessibility-page-structure-marker">${item.marker}</span>
        <span class="accessibility-page-structure-text"></span>
      `;
      itemButton.querySelector(".accessibility-page-structure-text").textContent = item.label;
      itemButton.addEventListener("click", () => scrollToStructureElement(item.element));
      structureList.appendChild(itemButton);
    });
  }

  function showPageStructureView() {
    const structureView = menu.querySelector(".accessibility-page-structure");
    const menuHeader = menu.querySelector(".accessibility-menu-header");
    const menuSections = menu.querySelector(".accessibility-menu-sections");
    if (!structureView || !menuHeader || !menuSections) {
      return;
    }
    menu.classList.add("is-page-structure-view");
    menuHeader.hidden = true;
    menuSections.hidden = true;
    structureView.hidden = false;
    renderPageStructure("headings");
  }

  function hidePageStructureView() {
    const structureView = menu.querySelector(".accessibility-page-structure");
    const menuHeader = menu.querySelector(".accessibility-menu-header");
    const menuSections = menu.querySelector(".accessibility-menu-sections");
    if (!structureView || !menuHeader || !menuSections) {
      return;
    }
    menu.classList.remove("is-page-structure-view");
    structureView.hidden = true;
    menuHeader.hidden = false;
    menuSections.hidden = false;
  }

  function getTooltipTarget(eventTarget) {
    if (!(eventTarget instanceof Element)) {
      return null;
    }
    return eventTarget.closest(
      "button, a, input, textarea, select, summary, [role='button'], [tabindex]:not([tabindex='-1']), [aria-label], [title], [data-accessibility-tooltip]",
    );
  }

  function getTooltipText(targetElement) {
    if (!targetElement || targetElement === tooltip || tooltip.contains(targetElement)) {
      return "";
    }

    const explicitText = targetElement.getAttribute("data-accessibility-tooltip")
      || targetElement.getAttribute("aria-label")
      || targetElement.getAttribute("title");
    if (explicitText?.trim()) {
      return explicitText.trim();
    }

    if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement || targetElement instanceof HTMLSelectElement) {
      const labelText = targetElement.labels?.[0]?.textContent?.trim();
      const placeholderText = targetElement.getAttribute("placeholder")?.trim();
      return labelText || placeholderText || targetElement.name || "";
    }

    return targetElement.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function positionAccessibilityTooltip(anchorElement) {
    if (tooltip.hidden || !anchorElement) {
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportPadding = 12;
    let top = anchorRect.top - tooltipRect.height - 10;
    let left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;

    if (top < viewportPadding) {
      top = anchorRect.bottom + 10;
    }

    left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - tooltipRect.width - viewportPadding, left),
    );

    tooltip.style.setProperty("--accessibility-tooltip-left", `${Math.round(left)}px`);
    tooltip.style.setProperty("--accessibility-tooltip-top", `${Math.round(top)}px`);
  }

  function showAccessibilityTooltip(targetElement) {
    if (!document.body.classList.contains("accessibility-tooltips-enabled")) {
      return;
    }

    const tooltipText = getTooltipText(targetElement);
    if (!tooltipText) {
      hideAccessibilityTooltip();
      return;
    }

    tooltip.textContent = tooltipText;
    tooltip.hidden = false;
    requestAnimationFrame(() => positionAccessibilityTooltip(targetElement));
  }

  function hideAccessibilityTooltip() {
    tooltip.hidden = true;
    tooltip.textContent = "";
  }

  function updateReadingMaskPosition(event) {
    if (!document.body.classList.contains("accessibility-reading-mask-active")) {
      return;
    }
    setReadingMaskPositionY(event.clientY);
  }

  function setReadingMaskPositionY(clientY) {
    const boundedClientY = Math.max(0, Math.min(window.innerHeight, Number(clientY) || 0));
    document.documentElement.style.setProperty(
      "--accessibility-reading-mask-y",
      `${Math.round(boundedClientY)}px`,
    );
  }

  function updateReadingMaskPositionFromFrame(frameElement, event) {
    if (!document.body.classList.contains("accessibility-reading-mask-active")) {
      return;
    }
    const frameRect = frameElement.getBoundingClientRect();
    setReadingMaskPositionY(frameRect.top + event.clientY);
  }

  function bindReadingMaskFrameDocument(frameElement) {
    const previousCleanup = readingMaskFrameCleanupByFrame.get(frameElement);
    if (previousCleanup) {
      previousCleanup();
      readingMaskFrameCleanupByFrame.delete(frameElement);
    }

    let frameDocument = null;
    try {
      frameDocument = frameElement.contentDocument || frameElement.contentWindow?.document || null;
    } catch {
      frameDocument = null;
    }

    if (!frameDocument) {
      return;
    }

    const framePointerMoveHandler = (event) => updateReadingMaskPositionFromFrame(frameElement, event);
    const frameMouseMoveHandler = (event) => updateReadingMaskPositionFromFrame(frameElement, event);

    frameDocument.addEventListener("pointermove", framePointerMoveHandler, { passive: true });
    frameDocument.addEventListener("mousemove", frameMouseMoveHandler, { passive: true });

    readingMaskFrameCleanupByFrame.set(frameElement, () => {
      frameDocument.removeEventListener("pointermove", framePointerMoveHandler);
      frameDocument.removeEventListener("mousemove", frameMouseMoveHandler);
    });
  }

  function attachReadingMaskFrameListeners(frameElement) {
    bindReadingMaskFrameDocument(frameElement);
    if (frameElement.dataset.accessibilityReadingMaskLoadBound === "true") {
      return;
    }
    frameElement.dataset.accessibilityReadingMaskLoadBound = "true";
    frameElement.addEventListener("load", () => {
      if (document.body.classList.contains("accessibility-reading-mask-active")) {
        bindReadingMaskFrameDocument(frameElement);
      }
    });
  }

  function syncReadingMaskFrameListeners() {
    document.querySelectorAll("iframe").forEach((frameElement) => {
      attachReadingMaskFrameListeners(frameElement);
    });
  }

  function getAccessibilityOptionConfig(optionId) {
    return ACCESSIBILITY_MAIN_OPTIONS.find((option) => option.id === optionId) || null;
  }

  function setAccessibilityOptionButtonActive(optionButton, isActive) {
    const optionId = optionButton.dataset.accessibilityOption || "";
    const optionConfig = getAccessibilityOptionConfig(optionId);
    const optionLabel = optionButton.querySelector(".accessibility-option-label");
    const optionIcon = optionButton.querySelector(".accessibility-option-icon");
    const optionLevelDots = optionButton.querySelectorAll(".accessibility-option-levels span");

    optionButton.classList.toggle("is-active", isActive);
    optionButton.setAttribute("aria-pressed", String(isActive));

    if (optionLabel) {
      optionLabel.textContent = isActive
        ? optionButton.dataset.activeLabel || optionConfig?.activeLabel || optionButton.dataset.defaultLabel || optionConfig?.label || optionLabel.textContent
        : optionButton.dataset.defaultLabel || optionConfig?.label || optionLabel.textContent;
    }

    if (optionIcon && optionConfig) {
      optionIcon.innerHTML = isActive
        ? optionConfig.activeIcon || optionConfig.icon
        : optionConfig.icon;
    }

    optionLevelDots.forEach((levelDot, levelIndex) => {
      levelDot.classList.toggle("is-active", isActive && levelIndex === 0);
    });
  }

  function setSaturationButtonState(optionButton, nextSaturationMode) {
    const optionConfig = getAccessibilityOptionConfig("saturation");
    const optionLabel = optionButton.querySelector(".accessibility-option-label");
    const optionIcon = optionButton.querySelector(".accessibility-option-icon");
    const optionLevelDots = optionButton.querySelectorAll(".accessibility-option-levels span");
    const isActive = nextSaturationMode !== "default";

    optionButton.classList.toggle("is-active", isActive);
    optionButton.classList.toggle("is-saturation-low", nextSaturationMode === "low");
    optionButton.classList.toggle("is-saturation-high", nextSaturationMode === "high");
    optionButton.setAttribute("aria-pressed", String(isActive));

    if (optionLabel) {
      optionLabel.textContent = nextSaturationMode === "high"
        ? "High Saturation"
        : nextSaturationMode === "low"
          ? "Low Saturation"
          : optionButton.dataset.defaultLabel || optionConfig?.label || "Saturation";
    }

    if (optionIcon && optionConfig?.icon) {
      optionIcon.innerHTML = optionConfig.icon;
    }

    optionLevelDots.forEach((levelDot, levelIndex) => {
      levelDot.classList.toggle("is-active", nextSaturationMode === "low" && levelIndex === 0);
      levelDot.classList.toggle("is-strong-active", nextSaturationMode === "high" && levelIndex <= 1);
    });
  }

  function cycleSaturationOption(optionButton) {
    const nextSaturationMode = saturationMode === "low"
      ? "high"
      : saturationMode === "high"
        ? "default"
        : "low";
    if (nextSaturationMode === "default") {
      activeOptionIds.delete("saturation");
    } else {
      activeOptionIds.add("saturation");
    }
    setSaturationMode(nextSaturationMode);
    setSaturationButtonState(optionButton, nextSaturationMode);
  }

  function setAccessibilityOptionActive(optionId, isActive) {
    const optionButton = menu.querySelector(`[data-accessibility-option="${optionId}"]`);
    if (isActive) {
      activeOptionIds.add(optionId);
    } else {
      activeOptionIds.delete(optionId);
    }
    if (optionButton) {
      setAccessibilityOptionButtonActive(optionButton, isActive);
    }
    if (optionId === "reading-aid") {
      setReadingMaskActive(isActive);
    }
    if (optionId === "big-cursor") {
      setBigCursorActive(isActive);
    }
    if (optionId === "stop-animation") {
      setStopAnimationActive(isActive);
    }
    if (optionId === "highlight-links") {
      setHighlightLinksActive(isActive);
    }
    if (optionId === "highlight-titles") {
      setHighlightTitlesActive(isActive);
    }
    if (optionId === "readable-fonts") {
      setReadableFontsActive(isActive);
    }
    if (optionId === "text-reader") {
      setTextReaderActive(isActive);
    }
    if (optionId === "saturation") {
      setSaturationMode(isActive ? "low" : "default");
    }
    if (optionId === "tooltips") {
      setTooltipsActive(isActive);
    }
  }

  function setAccessibilityProfileButtonActive(profileButton, isActive) {
    profileButton.classList.toggle("is-active", isActive);
    profileButton.setAttribute("aria-pressed", String(isActive));
  }

  function applyAdhdProfile(profileButton) {
    if (activeProfileIds.has("adhd")) {
      restoreAccessibilityWidgetDefaults();
      return;
    }
    activeProfileIds.add("adhd");
    setAccessibilityProfileButtonActive(profileButton, true);
    setAccessibilityOptionActive("reading-aid", true);
    setAccessibilityOptionActive("big-cursor", true);
    setAccessibilityOptionActive("stop-animation", true);
  }

  function applyDyslexiaProfile(profileButton) {
    if (activeProfileIds.has("dyslexia")) {
      restoreAccessibilityWidgetDefaults();
      return;
    }
    activeProfileIds.add("dyslexia");
    setAccessibilityProfileButtonActive(profileButton, true);
    setAccessibilityOptionActive("text-reader", true);
    setAccessibilityOptionActive("readable-fonts", true);
    setAccessibilityOptionActive("stop-animation", true);
    setAccessibilityOptionActive("tooltips", true);
  }

  function resetAccessibilityOptionButton(optionButton) {
    const optionId = optionButton.dataset.accessibilityOption || "";
    const optionConfig = getAccessibilityOptionConfig(optionId);
    const defaultLabel = optionButton.dataset.defaultLabel || optionConfig?.label || "";
    const optionLabel = optionButton.querySelector(".accessibility-option-label");
    const optionIcon = optionButton.querySelector(".accessibility-option-icon");
    const optionLevelDots = optionButton.querySelectorAll(".accessibility-option-levels span");

    optionButton.classList.remove("is-active");
    optionButton.setAttribute("aria-pressed", "false");

    if (optionLabel && defaultLabel) {
      optionLabel.textContent = defaultLabel;
    }

    if (optionIcon && optionConfig?.icon) {
      optionIcon.innerHTML = optionConfig.icon;
    }

    if (optionId === "saturation") {
      optionButton.classList.remove("is-saturation-low", "is-saturation-high");
    }

    optionLevelDots.forEach((levelDot) => {
      levelDot.classList.remove("is-active", "is-strong-active");
    });
  }

  function resetAccessibilityMenuSections() {
    menu.querySelectorAll("[data-accessibility-feature]").forEach((featureButton) => {
      const featureId = featureButton.dataset.accessibilityFeature || "";
      if (featureId !== "main-options") {
        return;
      }
      const optionsGrid = featureButton.parentElement?.querySelector(".accessibility-main-options-grid");
      featureButton.classList.remove("is-expanded");
      featureButton.setAttribute("aria-expanded", "false");
      if (optionsGrid) {
        optionsGrid.hidden = true;
      }
    });
  }

  function resetAccessibilityOptionButtons() {
    menu.querySelectorAll("[data-accessibility-option]").forEach((optionButton) => {
      resetAccessibilityOptionButton(optionButton);
    });
  }

  function resetAccessibilityProfileButtons() {
    activeProfileIds.clear();
    menu.querySelectorAll("[data-accessibility-profile]").forEach((profileButton) => {
      profileButton.classList.remove("is-active");
      profileButton.setAttribute("aria-pressed", "false");
    });
  }

  function restoreAccessibilityWidgetDefaults() {
    activeOptionIds.clear();
    activeProfileIds.clear();
    resetAccessibilityOptionButtons();
    resetAccessibilityProfileButtons();
    resetAccessibilityMenuSections();
    hidePageStructureView();
    setReadingMaskActive(false);
    setBigCursorActive(false);
    setStopAnimationActive(false);
    setHighlightLinksActive(false);
    setHighlightTitlesActive(false);
    setReadableFontsActive(false);
    setTextReaderActive(false);
    setSaturationMode("default");
    setTooltipsActive(false);
    restoreAccessibilityDefaults();
  }

  button.addEventListener("click", () => {
    if (button.classList.contains("is-spinning")) {
      return;
    }
    button.classList.add("is-spinning");
    window.setTimeout(() => {
      window.clearTimeout(menuCloseTimer);
      button.classList.remove("is-spinning");
      button.hidden = true;
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      syncOutsideClickFrameListeners();
      requestAnimationFrame(() => menu.classList.add("is-open"));
    }, ACCESSIBILITY_SPIN_DURATION_MS);
  });

  menu.querySelector(".accessibility-menu-close")?.addEventListener("click", closeMenu);
  menu.querySelectorAll("[data-accessibility-feature]").forEach((featureButton) => {
    featureButton.addEventListener("click", () => {
      const featureId = featureButton.dataset.accessibilityFeature || "";
      if (featureId === "main-options" || featureId === "profiles") {
        const optionsGrid = featureButton.parentElement?.querySelector(
          featureId === "profiles" ? ".accessibility-profile-options-grid" : ".accessibility-main-options-grid",
        );
        const nextExpandedState = featureButton.getAttribute("aria-expanded") !== "true";
        featureButton.classList.toggle("is-expanded", nextExpandedState);
        featureButton.setAttribute("aria-expanded", String(nextExpandedState));
        if (optionsGrid) {
          optionsGrid.hidden = !nextExpandedState;
        }
        return;
      }
      runAccessibilityMenuFeature(featureId);
    });
  });
  menu.querySelectorAll("[data-accessibility-option]").forEach((optionButton) => {
    optionButton.addEventListener("click", () => {
      const optionId = optionButton.dataset.accessibilityOption || "";
      if (optionId === "reading-aid") {
        const nextActiveState = !activeOptionIds.has(optionId);
        if (nextActiveState) {
          activeOptionIds.add(optionId);
        } else {
          activeOptionIds.delete(optionId);
        }
        setAccessibilityOptionButtonActive(optionButton, nextActiveState);
        setReadingMaskActive(nextActiveState);
        return;
      }
      if (optionId === "big-cursor") {
        const nextActiveState = !activeOptionIds.has(optionId);
        if (nextActiveState) {
          activeOptionIds.add(optionId);
        } else {
          activeOptionIds.delete(optionId);
        }
        setAccessibilityOptionButtonActive(optionButton, nextActiveState);
        setBigCursorActive(nextActiveState);
        return;
      }
      if (optionId === "stop-animation") {
        const nextActiveState = !activeOptionIds.has(optionId);
        if (nextActiveState) {
          activeOptionIds.add(optionId);
        } else {
          activeOptionIds.delete(optionId);
        }
        setAccessibilityOptionButtonActive(optionButton, nextActiveState);
        setStopAnimationActive(nextActiveState);
        return;
      }
      if (optionId === "highlight-links") {
        const nextActiveState = !activeOptionIds.has(optionId);
        setAccessibilityOptionActive(optionId, nextActiveState);
        return;
      }
      if (optionId === "highlight-titles") {
        const nextActiveState = !activeOptionIds.has(optionId);
        setAccessibilityOptionActive(optionId, nextActiveState);
        return;
      }
      if (optionId === "readable-fonts") {
        const nextActiveState = !activeOptionIds.has(optionId);
        setAccessibilityOptionActive(optionId, nextActiveState);
        return;
      }
      if (optionId === "text-reader") {
        const nextActiveState = !activeOptionIds.has(optionId);
        setAccessibilityOptionActive(optionId, nextActiveState);
        return;
      }
      if (optionId === "saturation") {
        cycleSaturationOption(optionButton);
        return;
      }
      if (optionId === "page-structure") {
        showPageStructureView();
        return;
      }
      if (optionId === "tooltips") {
        const nextActiveState = !activeOptionIds.has(optionId);
        setAccessibilityOptionActive(optionId, nextActiveState);
        return;
      }
      runAccessibilityMenuFeature(optionId);
    });
  });
  menu.querySelectorAll("[data-accessibility-profile]").forEach((profileButton) => {
    profileButton.addEventListener("click", () => {
      const profileId = profileButton.dataset.accessibilityProfile || "";
      if (profileId === "dyslexia") {
        applyDyslexiaProfile(profileButton);
      }
      if (profileId === "adhd") {
        applyAdhdProfile(profileButton);
      }
    });
  });
  menu.querySelector(".accessibility-restore-button")?.addEventListener("click", () => {
    restoreAccessibilityWidgetDefaults();
  });
  menu.querySelector(".accessibility-page-structure-back")?.addEventListener("click", hidePageStructureView);
  menu.querySelectorAll("[data-page-structure-tab]").forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      renderPageStructure(tabButton.dataset.pageStructureTab || "headings");
    });
  });

  document.body.append(button, menu, readingMask, tooltip);
  document.addEventListener("pointerdown", closeMenuAfterOutsidePointer, true);
  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("accessibility-text-reader-enabled")) {
      return;
    }
    selectTextReaderTarget(getTextReaderTarget(event.target));
  }, true);
  document.addEventListener("pointerover", (event) => {
    showAccessibilityTooltip(getTooltipTarget(event.target));
  }, true);
  document.addEventListener("pointerout", (event) => {
    const currentTarget = getTooltipTarget(event.target);
    const nextTarget = getTooltipTarget(event.relatedTarget);
    if (!currentTarget || currentTarget !== nextTarget) {
      hideAccessibilityTooltip();
    }
  }, true);
  document.addEventListener("focusin", (event) => {
    showAccessibilityTooltip(getTooltipTarget(event.target));
  }, true);
  document.addEventListener("focusout", hideAccessibilityTooltip, true);
  window.addEventListener("resize", hideAccessibilityTooltip);
  window.addEventListener("scroll", hideAccessibilityTooltip, true);
  window.addEventListener("pointermove", updateReadingMaskPosition, { passive: true });
}

export { createAccessibilityWidget };
