function eiInterruptType(location) {
  return String(location?.interrupt_type || location?.interruptType || "").trim() || "other";
}

function eiLocationLabel(location) {
  const type = eiInterruptType(location);
  const labels = {
    modal: "Modal / overlay",
    consent: "Cookie / consent prompt",
    chat: "Chat / sticky widget",
    notification: "Notification / toast",
    script: "Scripted interruption",
  };
  return labels[type] || "Interruption";
}

function eiSeveritySummary(location) {
  // Keep purely descriptive; do not invent new scoring.
  const flags = [];
  if (location?.overlay_like) flags.push("overlay-like");
  if (location?.blocks_scroll) flags.push("blocks scroll");
  if (location?.covers_primary_region) flags.push("covers primary region");
  if (location?.takes_focus) flags.push("takes focus");
  if (location?.dismiss_required) flags.push("dismiss required");
  if (location?.fixed_or_sticky) flags.push("fixed/sticky");
  return flags.length ? flags.join(" · ") : "";
}

function eiEvidenceMetrics(location) {
  const type = eiInterruptType(location);
  const severity = eiSeveritySummary(location);
  return severity ? `${type} · ${severity}` : type;
}

export {
  eiEvidenceMetrics,
  eiInterruptType,
  eiLocationLabel,
  eiSeveritySummary,
};

