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
    <path d="m6 15 6-6 6 6" />
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
    id: "manage",
    label: "Manage",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h4m4 0h8M4 17h8m4 0h4M8 5v4m8 6v4" />
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

export function runAccessibilityMenuFeature(featureId) {
  return { featureId, implemented: false };
}

export function restoreAccessibilityDefaults() {
  return { implemented: false };
}
