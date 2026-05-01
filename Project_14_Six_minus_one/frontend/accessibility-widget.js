import {
  ACCESSIBILITY_CHEVRON_ICON,
  ACCESSIBILITY_CLOSE_ICON,
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
        <button class="accessibility-menu-row" type="button" data-accessibility-feature="${section.id}">
          <span class="accessibility-menu-row-icon">${section.icon}</span>
          <span class="accessibility-menu-row-label">${section.label}</span>
          ${section.extraHtml || ""}
          <span class="accessibility-menu-chevron">${ACCESSIBILITY_CHEVRON_ICON}</span>
        </button>
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

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.hidden = true;
    button.hidden = false;
    button.setAttribute("aria-expanded", "false");
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
      runAccessibilityMenuFeature(featureButton.dataset.accessibilityFeature || "");
    });
  });
  menu.querySelector(".accessibility-restore-button")?.addEventListener("click", () => {
    restoreAccessibilityDefaults();
  });

  document.body.append(button, menu);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createAccessibilityWidget, { once: true });
} else {
  createAccessibilityWidget();
}
