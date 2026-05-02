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
      setMenuIsOpen(true);
    }, ACCESSIBILITY_SPIN_DURATION_MS);

    return () => window.clearTimeout(spinTimer);
  }, [buttonIsSpinning]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-reading-mask-active", readingMaskIsActive);
    if (!readingMaskIsActive) {
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
      return undefined;
    }

    const updateReadingMaskPosition = (event) => {
      document.documentElement.style.setProperty(
        "--accessibility-reading-mask-y",
        `${Math.round(event.clientY)}px`,
      );
    };

    document.documentElement.style.setProperty(
      "--accessibility-reading-mask-y",
      `${Math.round(window.innerHeight * 0.5)}px`,
    );
    window.addEventListener("pointermove", updateReadingMaskPosition, { passive: true });

    return () => {
      window.removeEventListener("pointermove", updateReadingMaskPosition);
      document.body.classList.remove("accessibility-reading-mask-active");
      document.documentElement.style.removeProperty("--accessibility-reading-mask-y");
    };
  }, [readingMaskIsActive]);

  useEffect(() => {
    document.body.classList.toggle("accessibility-big-cursor-enabled", bigCursorIsActive);
    return () => {
      document.body.classList.remove("accessibility-big-cursor-enabled");
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
    if (menuIsOpen || buttonIsSpinning) {
      return;
    }
    setButtonIsSpinning(true);
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
