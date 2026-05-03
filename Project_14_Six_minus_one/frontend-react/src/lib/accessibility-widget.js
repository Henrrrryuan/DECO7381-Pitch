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
  let activeTextAdjustMode = "text-size";
  let activeLanguage = "en";
  let hasOpenedAccessibilityMenu = false;
  const textAdjustLevels = {
    "text-size": "1",
    "text-spacing": "1",
    "height-spacing": "1",
    "letter-spacing": "1",
  };
  const BIG_CURSOR_FRAME_STYLE_ID = "cognilens-accessibility-big-cursor-style";
  const BIG_CURSOR_DEFAULT_URL = "https://img.icons8.com/ios/100/cursor--v1.png";
  const BIG_CURSOR_POINTER_URL = "https://img.icons8.com/?size=100&id=37397&format=png&color=000000";
  const languageCopy = {
    en: {
      menuTitle: "Accessibility Menu",
      restoreDefault: "Restore Default",
      featureLabels: { language: "Language", profiles: "Accessibility Profiles", "main-options": "Main Options", statement: "Accessibility Statement" },
      profiles: { dyslexia: "Dyslexia", autism: "Autism", adhd: "ADHD" },
      options: {
        "text-reader": "Text Reader",
        saturation: "Saturation",
        "highlight-links": "Highlight Links",
        "highlight-titles": "Highlight Titles",
        "readable-fonts": "Readable Fonts",
        "big-cursor": "Big Cursor",
        "stop-animation": "Stop Animation",
        "reading-aid": "Reading Aid",
        "page-structure": "Page Structure",
        tooltips: "Tooltips",
      },
      optionActiveLabels: { saturation: "Low Saturation", highSaturation: "High Saturation", "reading-aid": "Reading Mask" },
      textAdjust: { "text-size": "Text Size", "text-spacing": "Text Spacing", "height-spacing": "Height Spacing", "letter-spacing": "Letter Spacing" },
      statementIntro: "CogniLens is committed to supporting digital accessibility for all users, regardless of their abilities.",
      statementTitle: "Features",
      statementItems: [
        ["Accessibility Profiles", "Apply ready-made support modes for Dyslexia, Autism, and ADHD."],
        ["Text Reader", "Select readable text blocks with a dashed focus outline."],
        ["Saturation Settings", "Switch between low saturation, high saturation, and the default colour setting."],
        ["Content Adjustments", "Modify text size, text spacing, line height, and letter spacing for improved readability."],
        ["Highlight Links and Titles", "Emphasize key links and headings to help users locate important information."],
        ["Readable Fonts", "Activate a more readable font style for better clarity."],
        ["Big Cursor", "Enlarge the cursor to improve visibility."],
        ["Stop Animation", "Pause animations and transitions to reduce distractions."],
        ["Reading Aid", "Add a reading mask to help users focus on one horizontal area of content."],
        ["Page Structure", "Review headings, landmarks, and links for easier page navigation."],
        ["Tooltips", "Show helpful explanations when hovering over interactive controls."],
      ],
      pageStructure: {
        title: "Page Structure",
        tabs: { headings: "Heading", landmarks: "Landmarks", links: "Links" },
        descriptions: {
          headings: "Provides an overview of the website's layout, helping users navigate key sections with ease.",
          landmarks: "Divides the page into regions like headers and navigation, making it easier for assistive tools to guide users.",
          links: "Highlights key links on the site for quick and easy access to important sections.",
        },
        empty: "No matching page structure items found.",
      },
    },
    zh: {
      menuTitle: "无障碍菜单",
      restoreDefault: "恢复默认",
      featureLabels: { language: "语言", profiles: "无障碍模式", "main-options": "主要选项", statement: "无障碍声明" },
      profiles: { dyslexia: "阅读障碍", autism: "自闭症", adhd: "ADHD" },
      options: {
        "text-reader": "文本阅读器",
        saturation: "饱和度",
        "highlight-links": "高亮链接",
        "highlight-titles": "高亮标题",
        "readable-fonts": "易读字体",
        "big-cursor": "大光标",
        "stop-animation": "停止动画",
        "reading-aid": "阅读辅助",
        "page-structure": "页面结构",
        tooltips: "提示说明",
      },
      optionActiveLabels: { saturation: "低饱和度", highSaturation: "高饱和度", "reading-aid": "阅读遮罩" },
      textAdjust: { "text-size": "文字大小", "text-spacing": "词间距", "height-spacing": "行高间距", "letter-spacing": "字母间距" },
      statementIntro: "CogniLens 致力于为所有用户提供数字无障碍支持，无论用户能力如何。",
      statementTitle: "功能",
      statementItems: [
        ["无障碍模式", "提供阅读障碍、自闭症和 ADHD 的预设支持模式。"],
        ["文本阅读器", "点击文本块后，用虚线框帮助用户聚焦阅读内容。"],
        ["饱和度设置", "可在低饱和度、高饱和度和默认颜色之间切换。"],
        ["内容调节", "可调整文字大小、词间距、行高和字母间距，提升可读性。"],
        ["高亮链接和标题", "突出重要链接和标题，帮助用户快速定位信息。"],
        ["易读字体", "切换为更易阅读的字体样式。"],
        ["大光标", "放大光标，提高可见性。"],
        ["停止动画", "暂停动画和过渡效果，减少干扰。"],
        ["阅读辅助", "添加阅读遮罩，帮助用户聚焦当前横向阅读区域。"],
        ["页面结构", "查看标题、区域和链接，帮助用户更轻松地导航页面。"],
        ["提示说明", "悬停在交互控件上时显示说明。"],
      ],
      pageStructure: {
        title: "页面结构",
        tabs: { headings: "标题", landmarks: "区域", links: "链接" },
        descriptions: {
          headings: "概览网页布局，帮助用户更轻松地浏览关键内容区域。",
          landmarks: "将页面划分为页眉、导航、主体等区域，帮助用户理解页面结构。",
          links: "列出页面中的关键链接，方便快速访问重要部分。",
        },
        empty: "未找到对应的页面结构项目。",
      },
    },
  };
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
            ${section.id === "language" || section.id === "main-options" || section.id === "profiles" || section.id === "statement" ? 'aria-expanded="false"' : ""}
          >
            <span class="accessibility-menu-row-icon">${section.icon}</span>
            <span class="accessibility-menu-row-label">${section.label}</span>
            ${section.extraHtml || ""}
            <span class="accessibility-menu-chevron">${ACCESSIBILITY_CHEVRON_ICON}</span>
          </button>
          ${section.id === "language" ? `
            <div class="accessibility-language-options" hidden>
              <button class="accessibility-language-option is-active" type="button" data-accessibility-language="en" aria-pressed="true">
                <span class="accessibility-language-flag accessibility-language-flag--us" aria-hidden="true"></span>
                <span>English (USA)</span>
                <span class="accessibility-language-check" aria-hidden="true">✓</span>
              </button>
              <button class="accessibility-language-option" type="button" data-accessibility-language="zh" aria-pressed="false">
                <span class="accessibility-language-flag accessibility-language-flag--cn" aria-hidden="true"></span>
                <span>中文 (Chinese)</span>
                <span class="accessibility-language-check" aria-hidden="true">✓</span>
              </button>
            </div>
          ` : ""}
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
              <div class="accessibility-text-adjust-panel" aria-label="Text adjustment controls">
                <div class="accessibility-text-adjust-tools">
                  <button class="accessibility-text-adjust-tool is-active" type="button" data-text-adjust-mode="text-size" aria-pressed="true">
                    <span class="accessibility-text-adjust-value">x1.0</span>
                    <small>Text Size</small>
                  </button>
                  <button class="accessibility-text-adjust-tool" type="button" data-text-adjust-mode="text-spacing" aria-pressed="false">
                    <span class="accessibility-text-adjust-value">x1.0</span>
                    <small>Text Spacing</small>
                  </button>
                  <button class="accessibility-text-adjust-tool" type="button" data-text-adjust-mode="height-spacing" aria-pressed="false">
                    <span class="accessibility-text-adjust-value">x1.0</span>
                    <small>Height Spacing</small>
                  </button>
                  <button class="accessibility-text-adjust-tool" type="button" data-text-adjust-mode="letter-spacing" aria-pressed="false">
                    <span class="accessibility-text-adjust-value">x1.0</span>
                    <small>Letter Spacing</small>
                  </button>
                </div>
                <div class="accessibility-text-adjust-levels">
                  <button type="button" data-text-adjust-level="1">x1.0</button>
                  <button type="button" data-text-adjust-level="1.5">x1.5</button>
                  <button type="button" data-text-adjust-level="2">x2.0</button>
                </div>
              </div>
            </div>
          ` : ""}
          ${section.id === "statement" ? `
            <div class="accessibility-statement-panel" hidden>
              <p>
                CogniLens is committed to supporting digital accessibility for all users, regardless of their abilities.
              </p>
              <h3>Features</h3>
              <ul>
                <li><strong>Accessibility Profiles:</strong> Apply ready-made support modes for Dyslexia, Autism, and ADHD.</li>
                <li><strong>Text Reader:</strong> Select readable text blocks with a dashed focus outline.</li>
                <li><strong>Saturation Settings:</strong> Switch between low saturation, high saturation, and the default colour setting.</li>
                <li><strong>Content Adjustments:</strong> Modify text size, text spacing, line height, and letter spacing for improved readability.</li>
                <li><strong>Highlight Links and Titles:</strong> Emphasize key links and headings to help users locate important information.</li>
                <li><strong>Readable Fonts:</strong> Activate a more readable font style for better clarity.</li>
                <li><strong>Big Cursor:</strong> Enlarge the cursor to improve visibility.</li>
                <li><strong>Stop Animation:</strong> Pause animations and transitions to reduce distractions.</li>
                <li><strong>Reading Aid:</strong> Add a reading mask to help users focus on one horizontal area of content.</li>
                <li><strong>Page Structure:</strong> Review headings, landmarks, and links for easier page navigation.</li>
                <li><strong>Tooltips:</strong> Show helpful explanations when hovering over interactive controls.</li>
              </ul>
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
        <span class="accessibility-restore-label">Restore Default</span>
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

  function updateAccessibilityLanguage(nextLanguage) {
    activeLanguage = nextLanguage === "zh" ? "zh" : "en";
    const copy = languageCopy[activeLanguage];

    menu.querySelector(".accessibility-menu-header h2").textContent = copy.menuTitle;
    menu.querySelector(".accessibility-restore-label").textContent = copy.restoreDefault;
    menu.querySelector(".accessibility-page-structure-header h2").textContent = copy.pageStructure.title;

    menu.querySelectorAll("[data-accessibility-feature]").forEach((featureButton) => {
      const featureId = featureButton.dataset.accessibilityFeature || "";
      const label = featureButton.querySelector(".accessibility-menu-row-label");
      if (label && copy.featureLabels[featureId]) {
        label.textContent = copy.featureLabels[featureId];
      }
    });

    const languageChip = menu.querySelector(".accessibility-language-chip");
    languageChip?.classList.toggle("accessibility-language-chip--cn", activeLanguage === "zh");

    menu.querySelectorAll("[data-accessibility-profile]").forEach((profileButton) => {
      const profileId = profileButton.dataset.accessibilityProfile || "";
      const label = profileButton.querySelector(".accessibility-profile-label");
      if (label && copy.profiles[profileId]) {
        label.textContent = copy.profiles[profileId];
      }
    });

    menu.querySelectorAll("[data-accessibility-option]").forEach((optionButton) => {
      const optionId = optionButton.dataset.accessibilityOption || "";
      if (!copy.options[optionId]) {
        return;
      }
      optionButton.dataset.defaultLabel = copy.options[optionId];
      optionButton.dataset.activeLabel = copy.optionActiveLabels[optionId] || copy.options[optionId];
      const label = optionButton.querySelector(".accessibility-option-label");
      if (!label) {
        return;
      }
      if (optionId === "saturation" && saturationMode !== "default") {
        label.textContent = saturationMode === "high"
          ? copy.optionActiveLabels.highSaturation
          : copy.optionActiveLabels.saturation;
        return;
      }
      label.textContent = optionButton.getAttribute("aria-pressed") === "true"
        ? optionButton.dataset.activeLabel
        : optionButton.dataset.defaultLabel;
    });

    menu.querySelectorAll("[data-text-adjust-mode]").forEach((modeButton) => {
      const mode = modeButton.dataset.textAdjustMode || "";
      const label = modeButton.querySelector("small");
      if (label && copy.textAdjust[mode]) {
        label.textContent = copy.textAdjust[mode];
      }
    });

    menu.querySelectorAll("[data-page-structure-tab]").forEach((tabButton) => {
      const tab = tabButton.dataset.pageStructureTab || "headings";
      const icon = tabButton.querySelector("span")?.outerHTML || "";
      tabButton.innerHTML = `${icon}${copy.pageStructure.tabs[tab] || copy.pageStructure.tabs.headings}`;
    });

    const statementPanel = menu.querySelector(".accessibility-statement-panel");
    const statementIntro = statementPanel?.querySelector("p");
    const statementTitle = statementPanel?.querySelector("h3");
    const statementList = statementPanel?.querySelector("ul");
    if (statementIntro && statementTitle && statementList) {
      statementIntro.textContent = copy.statementIntro;
      statementTitle.textContent = copy.statementTitle;
      statementList.innerHTML = copy.statementItems
        .map(([title, description]) => `<li><strong>${title}:</strong> ${description}</li>`)
        .join("");
    }

    renderPageStructure(
      menu.querySelector("[data-page-structure-tab].is-active")?.dataset.pageStructureTab || "headings",
    );
  }

  function setActiveTextAdjustMode(nextMode) {
    activeTextAdjustMode = nextMode;
    menu.querySelectorAll("[data-text-adjust-mode]").forEach((modeButton) => {
      const isActive = modeButton.dataset.textAdjustMode === activeTextAdjustMode;
      modeButton.classList.toggle("is-active", isActive);
      modeButton.setAttribute("aria-pressed", String(isActive));
    });
    syncTextAdjustLevelButtons();
  }

  function syncTextAdjustLevelButtons() {
    const activeLevel = textAdjustLevels[activeTextAdjustMode] || "1";
    menu.querySelectorAll("[data-text-adjust-level]").forEach((levelButton) => {
      const isActive = levelButton.dataset.textAdjustLevel === activeLevel;
      levelButton.classList.toggle("is-active", isActive);
      levelButton.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateTextAdjustToolLabels() {
    menu.querySelectorAll("[data-text-adjust-mode]").forEach((modeButton) => {
      const level = textAdjustLevels[modeButton.dataset.textAdjustMode] || "1";
      const valueLabel = modeButton.querySelector(".accessibility-text-adjust-value");
      if (valueLabel) {
        valueLabel.textContent = `x${Number(level).toFixed(1)}`;
      }
    });
  }

  function applyTextAdjustments() {
    const textSizeLevel = Number(textAdjustLevels["text-size"]) || 1;
    const textSpacingLevel = Number(textAdjustLevels["text-spacing"]) || 1;
    const heightSpacingLevel = Number(textAdjustLevels["height-spacing"]) || 1;
    const letterSpacingLevel = Number(textAdjustLevels["letter-spacing"]) || 1;
    const hasAdjustment = Object.values(textAdjustLevels).some((level) => level !== "1");

    document.body.classList.toggle("accessibility-text-adjust-enabled", hasAdjustment);
    applyTextAdjustmentsToDocument(document, {
      textSizeLevel,
      textSpacingLevel,
      heightSpacingLevel,
      letterSpacingLevel,
      hasAdjustment,
    });
    document.querySelectorAll("iframe").forEach((frameElement) => {
      const frameDocument = getFrameDocument(frameElement);
      if (frameDocument) {
        applyTextAdjustmentsToDocument(frameDocument, {
          textSizeLevel,
          textSpacingLevel,
          heightSpacingLevel,
          letterSpacingLevel,
          hasAdjustment,
        });
      }
    });
    updateTextAdjustToolLabels();
    syncTextAdjustLevelButtons();
  }

  function getTextAdjustElements(targetDocument) {
    return Array.from(targetDocument.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, a, button, label, input, textarea, select, small, strong, span, td, th, dd, dt, figcaption"))
      .filter((element) => {
        if (!(element instanceof Element)) {
          return false;
        }
        if (targetDocument === document && element.closest(".accessibility-menu, .accessibility-widget-button, .accessibility-tooltip-bubble")) {
          return false;
        }
        return Boolean((element.textContent || element.getAttribute("value") || element.getAttribute("placeholder") || "").trim());
      });
  }

  function ensureOriginalTextAdjustStyles(elements, targetWindow) {
    const measuredStyles = elements.map((element) => {
      const computedStyle = targetWindow.getComputedStyle(element);
      return {
        element,
        fontSize: computedStyle.fontSize,
        lineHeight: computedStyle.lineHeight,
        letterSpacing: computedStyle.letterSpacing,
        wordSpacing: computedStyle.wordSpacing,
      };
    });

    measuredStyles.forEach(({ element, fontSize, lineHeight, letterSpacing, wordSpacing }) => {
      if (!element.dataset.accessibilityOriginalFontSize) {
        element.dataset.accessibilityOriginalFontSize = fontSize;
        element.dataset.accessibilityOriginalLineHeight = lineHeight;
        element.dataset.accessibilityOriginalLetterSpacing = letterSpacing;
        element.dataset.accessibilityOriginalWordSpacing = wordSpacing;
      }
    });
  }

  function applyTextAdjustmentsToDocument(targetDocument, levels) {
    const targetWindow = targetDocument.defaultView;
    if (!targetWindow) {
      return;
    }

    const elements = getTextAdjustElements(targetDocument);
    ensureOriginalTextAdjustStyles(elements, targetWindow);

    elements.forEach((element) => {
      if (!levels.hasAdjustment) {
        restoreTextAdjustElement(element);
        return;
      }

      const originalFontSize = parseFloat(element.dataset.accessibilityOriginalFontSize || "");
      const originalLineHeight = parseFloat(element.dataset.accessibilityOriginalLineHeight || "");
      element.style.fontSize = Number.isFinite(originalFontSize)
        ? `${originalFontSize * levels.textSizeLevel}px`
        : "";
      element.style.lineHeight = Number.isFinite(originalLineHeight)
        ? `${originalLineHeight * levels.heightSpacingLevel}px`
        : `${levels.heightSpacingLevel}`;
      element.style.wordSpacing = `${Math.max(0, levels.textSpacingLevel - 1) * 0.35}em`;
      element.style.letterSpacing = `${Math.max(0, levels.letterSpacingLevel - 1) * 0.12}em`;
    });
  }

  function restoreTextAdjustElement(element) {
    element.style.fontSize = "";
    element.style.lineHeight = "";
    element.style.wordSpacing = "";
    element.style.letterSpacing = "";
    delete element.dataset.accessibilityOriginalFontSize;
    delete element.dataset.accessibilityOriginalLineHeight;
    delete element.dataset.accessibilityOriginalLetterSpacing;
    delete element.dataset.accessibilityOriginalWordSpacing;
  }

  function setTextAdjustmentLevel(level) {
    textAdjustLevels[activeTextAdjustMode] = String(level);
    applyTextAdjustments();
  }

  function resetTextAdjustments() {
    Object.keys(textAdjustLevels).forEach((mode) => {
      textAdjustLevels[mode] = "1";
    });
    document.body.classList.remove("accessibility-text-adjust-enabled");
    applyTextAdjustmentsToDocument(document, {
      textSizeLevel: 1,
      textSpacingLevel: 1,
      heightSpacingLevel: 1,
      letterSpacingLevel: 1,
      hasAdjustment: false,
    });
    document.querySelectorAll("iframe").forEach((frameElement) => {
      const frameDocument = getFrameDocument(frameElement);
      if (frameDocument) {
        applyTextAdjustmentsToDocument(frameDocument, {
          textSizeLevel: 1,
          textSpacingLevel: 1,
          heightSpacingLevel: 1,
          letterSpacingLevel: 1,
          hasAdjustment: false,
        });
      }
    });
    updateTextAdjustToolLabels();
    setActiveTextAdjustMode("text-size");
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
    return languageCopy[activeLanguage].pageStructure.descriptions[activeTab]
      || languageCopy[activeLanguage].pageStructure.descriptions.headings;
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
      emptyState.textContent = languageCopy[activeLanguage].pageStructure.empty;
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

  function setMenuSectionExpanded(featureId, isExpanded) {
    const featureButton = menu.querySelector(`[data-accessibility-feature="${featureId}"]`);
    const panel = featureButton?.parentElement?.querySelector(
      featureId === "language"
        ? ".accessibility-language-options"
        : featureId === "profiles"
          ? ".accessibility-profile-options-grid"
          : ".accessibility-main-options-grid",
    );
    if (!featureButton || !panel) {
      return;
    }
    featureButton.classList.toggle("is-expanded", isExpanded);
    featureButton.setAttribute("aria-expanded", String(isExpanded));
    panel.hidden = !isExpanded;
  }

  function expandDefaultMenuSectionsOnce() {
    if (hasOpenedAccessibilityMenu) {
      return;
    }
    hasOpenedAccessibilityMenu = true;
    setMenuSectionExpanded("profiles", true);
    setMenuSectionExpanded("main-options", true);
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
        ? languageCopy[activeLanguage].optionActiveLabels.highSaturation
        : nextSaturationMode === "low"
          ? languageCopy[activeLanguage].optionActiveLabels.saturation
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

  function applyAutismProfile(profileButton) {
    if (activeProfileIds.has("autism")) {
      restoreAccessibilityWidgetDefaults();
      return;
    }
    activeProfileIds.add("autism");
    setAccessibilityProfileButtonActive(profileButton, true);
    setAccessibilityOptionActive("stop-animation", true);
    setAccessibilityOptionActive("tooltips", true);
    setAccessibilityOptionActive("text-reader", true);
    setAccessibilityOptionActive("readable-fonts", true);
    activeOptionIds.add("saturation");
    setSaturationMode("low");
    const saturationButton = menu.querySelector('[data-accessibility-option="saturation"]');
    if (saturationButton) {
      setSaturationButtonState(saturationButton, "low");
    }
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
    resetTextAdjustments();
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
      expandDefaultMenuSectionsOnce();
      syncOutsideClickFrameListeners();
      requestAnimationFrame(() => menu.classList.add("is-open"));
    }, ACCESSIBILITY_SPIN_DURATION_MS);
  });

  menu.querySelector(".accessibility-menu-close")?.addEventListener("click", closeMenu);
  menu.querySelectorAll("[data-accessibility-feature]").forEach((featureButton) => {
    featureButton.addEventListener("click", () => {
      const featureId = featureButton.dataset.accessibilityFeature || "";
      if (featureId === "language" || featureId === "main-options" || featureId === "profiles" || featureId === "statement") {
        const optionsGrid = featureButton.parentElement?.querySelector(
          featureId === "language"
            ? ".accessibility-language-options"
            : featureId === "profiles"
            ? ".accessibility-profile-options-grid"
            : featureId === "statement"
              ? ".accessibility-statement-panel"
              : ".accessibility-main-options-grid",
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
      if (profileId === "autism") {
        applyAutismProfile(profileButton);
      }
      if (profileId === "adhd") {
        applyAdhdProfile(profileButton);
      }
    });
  });
  menu.querySelectorAll("[data-accessibility-language]").forEach((languageButton) => {
    languageButton.addEventListener("click", () => {
      const nextLanguage = languageButton.dataset.accessibilityLanguage || "en";
      menu.querySelectorAll("[data-accessibility-language]").forEach((buttonElement) => {
        const isActive = buttonElement === languageButton;
        buttonElement.classList.toggle("is-active", isActive);
        buttonElement.setAttribute("aria-pressed", String(isActive));
      });
      updateAccessibilityLanguage(nextLanguage);
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
  menu.querySelectorAll("[data-text-adjust-mode]").forEach((modeButton) => {
    modeButton.addEventListener("click", () => {
      setActiveTextAdjustMode(modeButton.dataset.textAdjustMode || "text-size");
    });
  });
  menu.querySelectorAll("[data-text-adjust-level]").forEach((levelButton) => {
    levelButton.addEventListener("click", () => {
      setTextAdjustmentLevel(levelButton.dataset.textAdjustLevel || "1");
    });
  });
  updateTextAdjustToolLabels();
  syncTextAdjustLevelButtons();

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
