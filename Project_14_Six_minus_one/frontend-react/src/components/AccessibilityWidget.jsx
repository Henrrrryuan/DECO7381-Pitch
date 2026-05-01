import { useEffect, useState } from "react";

import {
  ACCESSIBILITY_CHEVRON_ICON,
  ACCESSIBILITY_CLOSE_ICON,
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
          {ACCESSIBILITY_MENU_FEATURES.map((section) => (
            <button
              className="accessibility-menu-row"
              type="button"
              key={section.label}
              onClick={() => runAccessibilityMenuFeature(section.id)}
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
          ))}
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
