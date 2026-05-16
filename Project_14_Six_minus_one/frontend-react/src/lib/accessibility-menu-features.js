export const ACCESSIBILITY_SPIN_DURATION_MS = 620;

export const ACCESSIBILITY_PERSON_ICON = `
  <svg class="accessibility-person-icon" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="14" r="7" />
    <path d="M16.2 24.5c9.4 3.4 22.2 3.4 31.6 0 3.1-1.1 5.2.7 5.7 2.9.5 2.2-.7 4.5-3.5 5.6-4.2 1.6-8.3 2.6-12.3 3v4.2l7.2 14c1.2 2.4.1 5.3-2.4 6.3-2.4 1-5.1-.1-6.2-2.4L32 49.6l-4.3 8.5c-1.1 2.3-3.8 3.4-6.2 2.4-2.5-1-3.6-3.9-2.4-6.3l7.2-14V36c-4-.4-8.1-1.4-12.3-3-2.8-1.1-4-3.4-3.5-5.6.5-2.2 2.6-4 5.7-2.9Z" />
  </svg>
`;

export const ACCESSIBILITY_CLOSE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
`;

export const ACCESSIBILITY_CHEVRON_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
`;

export const ACCESSIBILITY_RESTORE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6" />
  </svg>
`;

export const ACCESSIBILITY_MENU_FEATURES = [
  {
    id: "language",
    label: "Language",
    tooltip: "Select language. Current language: English",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h9M9 3v2m2 0c-.6 3.7-2.6 6.5-6 8.5m2.8-5.4c1 1.8 2.3 3.1 4.2 4.1M14 20l4-9 4 9m-6.7-3h5.4" />
      </svg>
    `,
    extraHtml: '<span class="accessibility-language-chip" aria-label="English language selected"></span>',
  },
  {
    id: "profiles",
    label: "Accessibility Profiles",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6m-8 9c-3.4 0-6 1.8-6 4v1h12v-1c0-2.2-2.6-4-6-4Zm8-.5c2.9.3 5 1.8 5 3.8v.7h-4" />
      </svg>
    `,
  },
  {
    id: "main-options",
    label: "Main Options",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4" />
      </svg>
    `,
  },
  {
    id: "statement",
    label: "Accessibility Statement",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h12v8H5V4Zm0 0v16h8m-5-5h5m-5 3h3m7 3a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-1-2 4-4" />
      </svg>
    `,
  },
];

export const ACCESSIBILITY_PROFILE_OPTIONS = [
  {
    id: "cognitive",
    label: "Cognitive",
    tooltip: "Highlight links and headings, and show helpful tooltips for easier scanning.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a4 4 0 0 1 7.4-2.1A4.5 4.5 0 0 1 20 6.3a4.3 4.3 0 0 1-2 7.5V18a2 2 0 0 1-2 2h-1.5M9 4a4.2 4.2 0 0 0-4 4.3 4.4 4.4 0 0 0 2 3.7V20h4" /><path d="M8 14h8M8 17h5M10 8h4" /></svg>',
  },
  {
    id: "dyslexia",
    label: "Dyslexia",
    tooltip: "Apply reading support: text reader, readable fonts, stop animation, and helpful tooltips.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M9 9h6v6H9z" /></svg>',
  },
  {
    id: "autism",
    label: "Autism",
    tooltip: "Apply calmer interface support: stop animation, low saturation, readable fonts, text reader, and tooltips.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4a3 3 0 0 1 5.6-1.5A3.5 3.5 0 0 1 19 5.4a3.6 3.6 0 0 1-.7 6.9 4 4 0 0 1-5.8 5.3A3.5 3.5 0 0 1 7 16a3.8 3.8 0 0 1-1-7.4A3.4 3.4 0 0 1 8 4Z" /></svg>',
  },
  {
    id: "adhd",
    label: "ADHD",
    tooltip: "Apply focus support: reading aid, larger cursor, and stopped animation.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v4m-5 4h10M8 20l1-8h6l1 8M7 7l10-2M6 20h12" /></svg>',
  },
];

export const ACCESSIBILITY_MAIN_OPTIONS = [
  {
    id: "text-reader",
    label: "Text Reader",
    tooltip: "Highlight selected text blocks so reading focus is easier to keep.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7zM10 4v7l2-1 2 1V4" /></svg>',
  },
  {
    id: "saturation",
    label: "Saturation",
    activeLabel: "Low Saturation",
    tooltip: "Tone down or strengthen page colours to reduce visual discomfort.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10Z" /><path d="M10 14h4" /></svg>',
    levels: 2,
  },
  {
    id: "highlight-links",
    label: "Highlight Links",
    tooltip: "Underline and emphasize links and clickable controls so actions are easier to identify.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-2M15 12a3 3 0 0 1-3 3H9a3 3 0 0 1 0-6h2" /></svg>',
  },
  {
    id: "highlight-titles",
    label: "Highlight Titles",
    tooltip: "Mark headings so page sections are easier to scan.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10M12 5v14" /></svg>',
  },
  {
    id: "readable-fonts",
    label: "Readable Fonts",
    tooltip: "Switch the page to a more readable font style.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h4.5a3 3 0 0 1 0 6H9V5Zm0 6h5a3.5 3.5 0 0 1 0 7H9v-7Z" /></svg>',
  },
  {
    id: "big-cursor",
    label: "Big Cursor",
    tooltip: "Make the pointer larger so it is easier to find on the screen.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14l3-3 2 5 3-1-2-5h5L7 4Z" /><circle cx="15" cy="9" r="5" /></svg>',
  },
  {
    id: "stop-animation",
    label: "Stop Animation",
    tooltip: "Pause motion and transitions to reduce distraction and sensory load.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10" /></svg>',
  },
  {
    id: "reading-aid",
    label: "Reading Aid",
    tooltip: "Add a horizontal reading mask to help focus on one line area at a time.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M8 19h11v-3" /><path d="M5 19V8" /></svg>',
    activeIcon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v4H5M16 5v4h3M8 19v-4H5M16 19v-4h3" /></svg>',
    activeLabel: "Reading Mask",
  },
  {
    id: "tooltips",
    label: "Tooltips",
    tooltip: "Show plain-language explanations when hovering over fields, buttons, and controls.",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z" /></svg>',
  },
];

export function runAccessibilityMenuFeature(featureId) {
  return { featureId, implemented: false };
}

export function restoreAccessibilityDefaults() {
  const documentElement = document.documentElement;
  const bodyElement = document.body;
  const restoredBodyClasses = [
    "accessibility-reading-mask-active",
    "accessibility-big-cursor-enabled",
    "accessibility-stop-animation-enabled",
    "accessibility-highlight-links-enabled",
    "accessibility-highlight-titles-enabled",
    "accessibility-readable-fonts-enabled",
    "accessibility-text-reader-enabled",
    "accessibility-saturation-low",
    "accessibility-saturation-high",
  ];
  const restoredDocumentVariables = [
    "--accessibility-reading-mask-y",
  ];

  restoredBodyClasses.forEach((className) => {
    bodyElement?.classList.remove(className);
  });

  restoredDocumentVariables.forEach((propertyName) => {
    documentElement?.style.removeProperty(propertyName);
  });

  return {
    implemented: true,
    restoredBodyClasses,
    restoredDocumentVariables,
  };
}
