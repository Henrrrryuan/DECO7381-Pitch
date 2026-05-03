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

    optionLevelDots.forEach((levelDot) => {
      levelDot.classList.remove("is-active");
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
    setReadingMaskActive(false);
    setBigCursorActive(false);
    setStopAnimationActive(false);
    setHighlightLinksActive(false);
    setHighlightTitlesActive(false);
    setReadableFontsActive(false);
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
      if (profileId === "adhd") {
        applyAdhdProfile(profileButton);
      }
    });
  });
  menu.querySelector(".accessibility-restore-button")?.addEventListener("click", () => {
    restoreAccessibilityWidgetDefaults();
  });

  document.body.append(button, menu, readingMask, tooltip);
  document.addEventListener("pointerdown", closeMenuAfterOutsidePointer, true);
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
