import {
  ACCESSIBILITY_CHEVRON_ICON,
  ACCESSIBILITY_CLOSE_ICON,
  ACCESSIBILITY_MAIN_OPTIONS,
  ACCESSIBILITY_MENU_FEATURES,
  ACCESSIBILITY_PERSON_ICON,
  ACCESSIBILITY_RESTORE_ICON,
  ACCESSIBILITY_SPIN_DURATION_MS,
  restoreAccessibilityDefaults,
  runAccessibilityMenuFeature,
} from "./accessibility-menu-features.js";

function createAccessibilityWidget() {
  if (document.querySelector(".accessibility-widget-button, .accessibility-menu")) {
    return;
  }

  const button = document.createElement("button");
  const activeOptionIds = new Set();
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
            ${section.id === "main-options" ? 'aria-expanded="false"' : ""}
          >
            <span class="accessibility-menu-row-icon">${section.icon}</span>
            <span class="accessibility-menu-row-label">${section.label}</span>
            ${section.extraHtml || ""}
            <span class="accessibility-menu-chevron">${ACCESSIBILITY_CHEVRON_ICON}</span>
          </button>
          ${section.id === "main-options" ? `
            <div class="accessibility-main-options-grid" hidden>
              ${ACCESSIBILITY_MAIN_OPTIONS.map((option) => `
                <button
                  class="accessibility-option-card"
                  type="button"
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

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.hidden = true;
    button.hidden = false;
    button.setAttribute("aria-expanded", "false");
  }

  function setReadingMaskActive(isActive) {
    document.body.classList.toggle("accessibility-reading-mask-active", isActive);
    if (!isActive) {
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
      return;
    }
    document.documentElement.style.setProperty(
      "--accessibility-reading-mask-y",
      `${Math.round(window.innerHeight * 0.5)}px`,
    );
  }

  function updateReadingMaskPosition(event) {
    if (!document.body.classList.contains("accessibility-reading-mask-active")) {
      return;
    }
    document.documentElement.style.setProperty(
      "--accessibility-reading-mask-y",
      `${Math.round(event.clientY)}px`,
    );
  }

  button.addEventListener("click", () => {
    if (button.classList.contains("is-spinning")) {
      return;
    }
    button.classList.add("is-spinning");
    window.setTimeout(() => {
      button.classList.remove("is-spinning");
      button.hidden = true;
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("is-open"));
    }, ACCESSIBILITY_SPIN_DURATION_MS);
  });

  menu.querySelector(".accessibility-menu-close")?.addEventListener("click", closeMenu);
  menu.querySelectorAll("[data-accessibility-feature]").forEach((featureButton) => {
    featureButton.addEventListener("click", () => {
      const featureId = featureButton.dataset.accessibilityFeature || "";
      if (featureId === "main-options") {
        const optionsGrid = featureButton.parentElement?.querySelector(".accessibility-main-options-grid");
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
        optionButton.classList.toggle("is-active", nextActiveState);
        optionButton.setAttribute("aria-pressed", String(nextActiveState));
        const optionLabel = optionButton.querySelector(".accessibility-option-label");
        if (optionLabel) {
          optionLabel.textContent = nextActiveState
            ? optionButton.dataset.activeLabel || optionLabel.textContent
            : optionButton.dataset.defaultLabel || optionLabel.textContent;
        }
        const firstLevelDot = optionButton.querySelector(".accessibility-option-levels span");
        firstLevelDot?.classList.toggle("is-active", nextActiveState);
        setReadingMaskActive(nextActiveState);
        return;
      }
      runAccessibilityMenuFeature(optionId);
    });
  });
  menu.querySelector(".accessibility-restore-button")?.addEventListener("click", () => {
    restoreAccessibilityDefaults();
  });

  document.body.append(button, menu, readingMask);
  window.addEventListener("pointermove", updateReadingMaskPosition, { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createAccessibilityWidget, { once: true });
} else {
  createAccessibilityWidget();
}
