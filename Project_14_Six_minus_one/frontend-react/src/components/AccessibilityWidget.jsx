import { useEffect, useState } from "react";

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
} from "./accessibilityMenuFeatures.js";

function SvgMarkup({ markup, className = "" }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function AccessibilityWidget() {
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const [buttonIsSpinning, setButtonIsSpinning] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState("");

  useEffect(() => {
    if (!buttonIsSpinning) {
      return undefined;
    }

    const spinTimer = window.setTimeout(() => {
      setButtonIsSpinning(false);
      setMenuIsOpen(true);
    }, ACCESSIBILITY_SPIN_DURATION_MS);

    return () => window.clearTimeout(spinTimer);
  }, [buttonIsSpinning]);

  function openMenuAfterSpin() {
    if (menuIsOpen || buttonIsSpinning) {
      return;
    }
    setButtonIsSpinning(true);
  }

  function handleMenuSectionClick(sectionId) {
    if (sectionId === "main-options") {
      setExpandedSectionId((currentSectionId) => (
        currentSectionId === sectionId ? "" : sectionId
      ));
      return;
    }
    runAccessibilityMenuFeature(sectionId);
  }

  function renderOptionLevels(levelCount) {
    if (!levelCount) {
      return null;
    }
    return (
      <span className="accessibility-option-levels" aria-hidden="true">
        {Array.from({ length: levelCount }).map((_, levelIndex) => (
          <span key={levelIndex} />
        ))}
      </span>
    );
  }

  return (
    <>
      <button
        className={`accessibility-widget-button${buttonIsSpinning ? " is-spinning" : ""}`}
        type="button"
        aria-label="Open accessibility menu"
        aria-controls="accessibilityMenu"
        aria-expanded={menuIsOpen}
        hidden={menuIsOpen}
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
        hidden={!menuIsOpen}
      >
        <header className="accessibility-menu-header">
          <h2>Accessibility Menu</h2>
          <button
            className="accessibility-menu-close"
            type="button"
            aria-label="Close accessibility menu"
            onClick={() => setMenuIsOpen(false)}
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
                  aria-expanded={section.id === "main-options" ? sectionIsExpanded : undefined}
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
                {section.id === "main-options" && sectionIsExpanded ? (
                  <div className="accessibility-main-options-grid">
                    {ACCESSIBILITY_MAIN_OPTIONS.map((option) => (
                      <button
                        className="accessibility-option-card"
                        type="button"
                        key={option.id}
                        onClick={() => runAccessibilityMenuFeature(option.id)}
                      >
                        <SvgMarkup className="accessibility-option-icon" markup={option.icon} />
                        <span>{option.label}</span>
                        {renderOptionLevels(option.levels)}
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
          <button className="accessibility-restore-button" type="button" onClick={restoreAccessibilityDefaults}>
            <SvgMarkup markup={ACCESSIBILITY_RESTORE_ICON} />
            Restore Default
          </button>
        </footer>
      </aside>
    </>
  );
}
