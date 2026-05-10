function amcUnderlyingIssueType(location) {
  // Backend AMC locations are inherited from ID-1 / ID-2 issue shapes.
  // Some locations include a "tag" (video/audio/iframe/script), while ID-2 locations may have "region".
  const tag = String(location?.tag || "").toLowerCase();
  const summary = String(location?.summary || "").toLowerCase();
  const snippet = String(location?.html_snippet || "").toLowerCase();
  const blob = `${tag} ${summary} ${snippet}`;
  if (tag === "video" || tag === "audio" || (tag === "iframe" && blob.includes("autoplay"))) {
    return "ID-1";
  }
  if (blob.includes("script-driven motion signal") || blob.includes("motion signal")) {
    return "ID-2";
  }
  // Heuristic: region-scoped animated evidence belongs to ID-2.
  if (String(location?.region || "")) {
    return "ID-2";
  }
  // Default: treat as autoplay-media evidence (safer for label/summary copy).
  return "ID-1";
}

function amcPrimaryMovementType(location) {
  const underlying = amcUnderlyingIssueType(location);
  return underlying === "ID-2" ? "animation" : "autoplay";
}

function amcLocationSelectorHint(location) {
  // Non-breaking: purely a display/debug hint. Never used for DOM querying.
  const tag = String(location?.tag || "").toLowerCase();
  const src = String(location?.src || "").trim();
  const muted = location?.muted === true ? "muted" : "";
  if (tag === "video" && muted) return `video[autoplay][${muted}]`;
  if (tag === "video") return "video[autoplay]";
  if (tag === "audio") return "audio[autoplay]";
  if (tag === "iframe") return src ? `iframe[src*="${src.slice(0, 24)}…"]` : "iframe";
  return tag || "";
}

function amcLocationLabel(location) {
  const tag = String(location?.tag || "").toLowerCase();
  if (tag === "video") return "Autoplay video";
  if (tag === "audio") return "Autoplay audio";
  if (tag === "iframe") return "Autoplay iframe";
  if (tag === "script") return "Script signal";
  return "Moving content";
}

function amcAutoplaySummary(location) {
  const tag = String(location?.tag || "").toLowerCase();
  if (tag === "video" || tag === "audio") {
    const muted = location?.muted === true ? "Muted autoplay" : "Autoplay";
    return muted;
  }
  if (tag === "iframe") {
    const src = String(location?.src || "").trim();
    return src ? `Autoplay iframe: ${src}` : "Autoplay iframe";
  }
  return "";
}

function amcAnimationSummary(location) {
  const region = String(location?.region || "").trim();
  const summary = String(location?.summary || "").trim();
  if (region && summary) return `${summary} · ${region}`;
  return summary || region || "";
}

function amcEvidenceMetricsLine(location) {
  // Keep extremely lightweight: AMC evidence is not metric-heavy like SC/LC/NC.
  const movement = amcPrimaryMovementType(location);
  if (movement === "autoplay") {
    const text = amcAutoplaySummary(location);
    return text || "Autoplay signal";
  }
  const text = amcAnimationSummary(location);
  return text || "Motion / animation signal";
}

export {
  amcAnimationSummary,
  amcAutoplaySummary,
  amcEvidenceMetricsLine,
  amcLocationLabel,
  amcLocationSelectorHint,
  amcPrimaryMovementType,
  amcUnderlyingIssueType,
};

