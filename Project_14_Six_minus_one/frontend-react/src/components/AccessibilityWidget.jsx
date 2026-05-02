import { useEffect, useState } from "react";

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
} from "./accessibilityMenuFeatures.js";

const ACCESSIBILITY_MENU_FADE_DURATION_MS = 840;
const BIG_CURSOR_FRAME_STYLE_ID = "cognilens-accessibility-big-cursor-style";
const BIG_CURSOR_DEFAULT_URL = "https://img.icons8.com/ios/100/cursor--v1.png";
const BIG_CURSOR_POINTER_URL = "https://img.icons8.com/?size=100&id=37397&format=png&color=000000";

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

function SvgMarkup({ markup, className = "" }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function AccessibilityWidget() {
  const [menuIsRendered, setMenuIsRendered] = useState(false);
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const [buttonIsSpinning, setButtonIsSpinning] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState("");
  const [activeOptionIds, setActiveOptionIds] = useState(() => new Set());
  const [activeProfileIds, setActiveProfileIds] = useState(() => new Set());
  const readingMaskIsActive = activeOptionIds.has("reading-aid");
  const bigCursorIsActive = activeOptionIds.has("big-cursor");
  const stopAnimationIsActive = activeOptionIds.has("stop-animation");
  const highlightLinksIsActive = activeOptionIds.has("highlight-links");
  const highlightTitlesIsActive = activeOptionIds.has("highlight-titles");

  useEffect(() => {
    if (!buttonIsSpinning) {
      return undefined;
    }

    const spinTimer = window.setTimeout(() => {
      setButtonIsSpinning(false);
      setMenuIsRendered(true);
      window.requestAnimationFrame(() => {
        setMenuIsOpen(true);
      });
    }, ACCESSIBILITY_SPIN_DURATION_MS);

    return () => window.clearTimeout(spinTimer);
  }, [buttonIsSpinning]);

  useEffect(() => {
    if (menuIsOpen || !menuIsRendered) {
      return undefined;
    }

    const closeTimer = window.setTimeout(() => {
      setMenuIsRendered(false);
    }, ACCESSIBILITY_MENU_FADE_DURATION_MS);

    return () => window.clearTimeout(closeTimer);
  }, [menuIsOpen, menuIsRendered]);

  useEffect(() => {
    if (!menuIsRendered) {
      return undefined;
    }

    const frameCleanupCallbacks = [];

    const closeMenuAfterOutsidePointer = (event) => {
      const menuElement = document.getElementById("accessibilityMenu");
      const widgetButton = document.querySelector(".accessibility-widget-button");
      const eventTarget = event.target;

      if (!menuElement || menuElement.contains(eventTarget) || widgetButton?.contains(eventTarget)) {
        return;
      }

      setMenuIsOpen(false);
    };

    const closeMenuFromFramePointer = () => {
      setMenuIsOpen(false);
    };

    const bindOutsideClickFrameDocument = (frameElement) => {
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
      frameCleanupCallbacks.push(() => {
        frameDocument.removeEventListener("pointerdown", closeMenuFromFramePointer, true);
      });
    };

    const bindOutsideClickFrame = (frameElement) => {
      bindOutsideClickFrameDocument(frameElement);

      const rebindOutsideClickFrameDocument = () => {
        bindOutsideClickFrameDocument(frameElement);
      };

      frameElement.addEventListener("load", rebindOutsideClickFrameDocument);
      frameCleanupCallbacks.push(() => {
        frameElement.removeEventListener("load", rebindOutsideClickFrameDocument);
      });
    };

    document.querySelectorAll("iframe").forEach((frameElement) => {
      bindOutsideClickFrame(frameElement);
    });

    document.addEventListener("pointerdown", closeMenuAfterOutsidePointer, true);

    return () => {
      document.removeEventListener("pointerdown", closeMenuAfterOutsidePointer, true);
      frameCleanupCallbacks.forEach((cleanupCallback) => cleanupCallback());
    };
  }, [menuIsRendered]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-reading-mask-active", readingMaskIsActive);
    if (!readingMaskIsActive) {
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
      return undefined;
    }

    const frameCleanupCallbacks = [];

    const setReadingMaskPositionY = (clientY) => {
      const boundedClientY = Math.max(0, Math.min(window.innerHeight, Number(clientY) || 0));
      document.documentElement.style.setProperty(
        "--accessibility-reading-mask-y",
        `${Math.round(boundedClientY)}px`,
      );
    };

    const updateReadingMaskPosition = (event) => {
      setReadingMaskPositionY(event.clientY);
    };

    const bindReadingMaskFrameDocument = (frameElement) => {
      let frameDocument = null;
      try {
        frameDocument = frameElement.contentDocument || frameElement.contentWindow?.document || null;
      } catch {
        frameDocument = null;
      }

      if (!frameDocument) {
        return;
      }

      const updateReadingMaskPositionFromFrame = (event) => {
        const frameRect = frameElement.getBoundingClientRect();
        setReadingMaskPositionY(frameRect.top + event.clientY);
      };

      frameDocument.addEventListener("pointermove", updateReadingMaskPositionFromFrame, { passive: true });
      frameDocument.addEventListener("mousemove", updateReadingMaskPositionFromFrame, { passive: true });

      frameCleanupCallbacks.push(() => {
        frameDocument.removeEventListener("pointermove", updateReadingMaskPositionFromFrame);
        frameDocument.removeEventListener("mousemove", updateReadingMaskPositionFromFrame);
      });
    };

    const bindReadingMaskFrame = (frameElement) => {
      bindReadingMaskFrameDocument(frameElement);

      const rebindReadingMaskFrameDocument = () => {
        bindReadingMaskFrameDocument(frameElement);
      };

      frameElement.addEventListener("load", rebindReadingMaskFrameDocument);
      frameCleanupCallbacks.push(() => {
        frameElement.removeEventListener("load", rebindReadingMaskFrameDocument);
      });
    };

    setReadingMaskPositionY(window.innerHeight * 0.5);
    document.querySelectorAll("iframe").forEach((frameElement) => {
      bindReadingMaskFrame(frameElement);
    });
    window.addEventListener("pointermove", updateReadingMaskPosition, { passive: true });

    return () => {
      window.removeEventListener("pointermove", updateReadingMaskPosition);
      frameCleanupCallbacks.forEach((cleanupCallback) => cleanupCallback());
      document.body.classList.remove("accessibility-reading-mask-active");
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
    };
  }, [readingMaskIsActive]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-big-cursor-enabled", bigCursorIsActive);
    const frameCleanupCallbacks = [];

    if (bigCursorIsActive) {
      document.querySelectorAll("iframe").forEach((frameElement) => {
        injectBigCursorFrameStyle(frameElement);

        const reapplyBigCursorFrameStyle = () => {
          injectBigCursorFrameStyle(frameElement);
        };

        frameElement.addEventListener("load", reapplyBigCursorFrameStyle);
        frameCleanupCallbacks.push(() => {
          frameElement.removeEventListener("load", reapplyBigCursorFrameStyle);
          removeBigCursorFrameStyle(frameElement);
        });
      });
    } else {
      document.querySelectorAll("iframe").forEach((frameElement) => {
        removeBigCursorFrameStyle(frameElement);
      });
    }

    return () => {
      document.body.classList.remove("accessibility-big-cursor-enabled");
      frameCleanupCallbacks.forEach((cleanupCallback) => cleanupCallback());
    };
  }, [bigCursorIsActive]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-stop-animation-enabled", stopAnimationIsActive);
    return () => {
      document.body.classList.remove("accessibility-stop-animation-enabled");
    };
  }, [stopAnimationIsActive]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-highlight-links-enabled", highlightLinksIsActive);
    return () => {
      document.body.classList.remove("accessibility-highlight-links-enabled");
    };
  }, [highlightLinksIsActive]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-highlight-titles-enabled", highlightTitlesIsActive);
    return () => {
      document.body.classList.remove("accessibility-highlight-titles-enabled");
    };
  }, [highlightTitlesIsActive]);

  function openMenuAfterSpin() {
    if (menuIsRendered || menuIsOpen || buttonIsSpinning) {
      return;
    }
    setButtonIsSpinning(true);
  }

  function closeMenuWithFade() {
    setMenuIsOpen(false);
  }

  function handleMenuSectionClick(sectionId) {
    if (sectionId === "main-options" || sectionId === "profiles") {
      setExpandedSectionId((currentSectionId) => (
        currentSectionId === sectionId ? "" : sectionId
      ));
      return;
    }
    runAccessibilityMenuFeature(sectionId);
  }

  function renderOptionLevelsWithState(option) {
    if (!option.levels) {
      return null;
    }
    const optionIsActive = activeOptionIds.has(option.id);
    return (
      <span className="accessibility-option-levels" aria-hidden="true">
        {Array.from({ length: option.levels }).map((_, levelIndex) => (
          <span
            className={optionIsActive && levelIndex === 0 ? "is-active" : ""}
            key={levelIndex}
          />
        ))}
      </span>
    );
  }

  function toggleAccessibilityOption(optionId) {
    if (
      optionId === "reading-aid"
      || optionId === "big-cursor"
      || optionId === "stop-animation"
      || optionId === "highlight-links"
      || optionId === "highlight-titles"
    ) {
      setActiveOptionIds((currentOptionIds) => {
        const nextOptionIds = new Set(currentOptionIds);
        if (nextOptionIds.has(optionId)) {
          nextOptionIds.delete(optionId);
        } else {
          nextOptionIds.add(optionId);
        }
        return nextOptionIds;
      });
      return;
    }
    runAccessibilityMenuFeature(optionId);
  }

  function activateAccessibilityProfile(profileId) {
    if (profileId !== "adhd") {
      return;
    }
    if (activeProfileIds.has(profileId)) {
      restoreAccessibilityWidgetDefaults();
      return;
    }
    setActiveProfileIds((currentProfileIds) => {
      const nextProfileIds = new Set(currentProfileIds);
      nextProfileIds.add(profileId);
      return nextProfileIds;
    });
    setActiveOptionIds((currentOptionIds) => {
      const nextOptionIds = new Set(currentOptionIds);
      nextOptionIds.add("reading-aid");
      nextOptionIds.add("big-cursor");
      nextOptionIds.add("stop-animation");
      return nextOptionIds;
    });
  }

  function restoreAccessibilityWidgetDefaults() {
    restoreAccessibilityDefaults();
    setActiveOptionIds(new Set());
    setActiveProfileIds(new Set());
    setExpandedSectionId("");
    setButtonIsSpinning(false);
  }

  return (
    <>
      <button
        className={`accessibility-widget-button${buttonIsSpinning ? " is-spinning" : ""}`}
        type="button"
        aria-label="Open accessibility menu"
        aria-controls="accessibilityMenu"
        aria-expanded={menuIsOpen && menuIsRendered}
        hidden={menuIsRendered}
        onClick={openMenuAfterSpin}
      >
        <span className="accessibility-widget-ring">
          <SvgMarkup markup={ACCESSIBILITY_PERSON_ICON} />
        </span>
      </button>

      <aside
        id="accessibilityMenu"
        className={`accessibility-menu${menuIsOpen ? " is-open" : ""}`}
        aria-label="Accessibility Menu"
        hidden={!menuIsRendered}
      >
        <header className="accessibility-menu-header">
          <h2>Accessibility Menu</h2>
          <button
            className="accessibility-menu-close"
            type="button"
            aria-label="Close accessibility menu"
            onClick={closeMenuWithFade}
          >
            <SvgMarkup markup={ACCESSIBILITY_CLOSE_ICON} />
          </button>
        </header>

        <div className="accessibility-menu-sections">
          {ACCESSIBILITY_MENU_FEATURES.map((section) => {
            const sectionIsExpanded = expandedSectionId === section.id;
            return (
              <div className="accessibility-menu-section" key={section.label}>
                <button
                  className={`accessibility-menu-row${sectionIsExpanded ? " is-expanded" : ""}`}
                  type="button"
                  aria-expanded={section.id === "main-options" || section.id === "profiles" ? sectionIsExpanded : undefined}
                  onClick={() => handleMenuSectionClick(section.id)}
                >
                  <SvgMarkup className="accessibility-menu-row-icon" markup={section.icon} />
                  <span className="accessibility-menu-row-label">{section.label}</span>
                  {section.extraHtml ? (
                    <SvgMarkup markup={section.extraHtml} />
                  ) : null}
                  <span className="accessibility-menu-chevron">
                    <SvgMarkup markup={ACCESSIBILITY_CHEVRON_ICON} />
                  </span>
                </button>
                {section.id === "profiles" && sectionIsExpanded ? (
                  <div className="accessibility-profile-options-grid">
                    {ACCESSIBILITY_PROFILE_OPTIONS.map((profile) => (
                      <button
                        className={`accessibility-profile-card${activeProfileIds.has(profile.id) ? " is-active" : ""}`}
                        type="button"
                        key={profile.id}
                        aria-pressed={activeProfileIds.has(profile.id)}
                        onClick={() => activateAccessibilityProfile(profile.id)}
                      >
                        <SvgMarkup className="accessibility-profile-icon" markup={profile.icon} />
                        <span className="accessibility-profile-label">{profile.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {section.id === "main-options" && sectionIsExpanded ? (
                  <div className="accessibility-main-options-grid">
                    {ACCESSIBILITY_MAIN_OPTIONS.map((option) => (
                      <button
                        className={`accessibility-option-card${activeOptionIds.has(option.id) ? " is-active" : ""}`}
                        type="button"
                        key={option.id}
                        aria-pressed={activeOptionIds.has(option.id)}
                        onClick={() => toggleAccessibilityOption(option.id)}
                      >
                        <SvgMarkup
                          className="accessibility-option-icon"
                          markup={activeOptionIds.has(option.id) ? (option.activeIcon || option.icon) : option.icon}
                        />
                        <span>{activeOptionIds.has(option.id) ? (option.activeLabel || option.label) : option.label}</span>
                        {renderOptionLevelsWithState(option)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <footer className="accessibility-menu-footer">
          <strong className="accessibility-menu-brand">CogniLens</strong>
          <button className="accessibility-restore-button" type="button" onClick={restoreAccessibilityWidgetDefaults}>
            <SvgMarkup markup={ACCESSIBILITY_RESTORE_ICON} />
            Restore Default
          </button>
        </footer>
      </aside>
      <div className="accessibility-reading-mask" aria-hidden="true">
        <span className="accessibility-reading-mask-top" />
        <span className="accessibility-reading-mask-band" />
        <span className="accessibility-reading-mask-bottom" />
      </div>
    </>
  );
}
