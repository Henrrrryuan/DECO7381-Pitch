export const ATTENTION_RISK_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

export const EYE_EVIDENCE_DETAIL_FALLBACK =
  "Eye evidence is available, but detailed element risk data is not available for this run.";

const ELEMENT_TYPE_ALIASES = {
  heading: "headings",
  headings: "headings",
  interactive: "interactive",
  "interactive elements": "interactive",
  button: "interactive",
  link: "interactive",
  main: "main_text",
  "main text": "main_text",
  main_text: "main_text",
  text: "main_text",
  media: "media",
  image: "media",
  images: "media",
  "images/media": "media",
  navigation: "navigation",
  nav: "navigation",
};

const ELEMENT_EVIDENCE_COPY = {
  headings: {
    label: "Headings",
    historyIdea: "understand the structure",
    detailIdea: "understand the page structure",
    interpretations: {
      high: "Users may not notice the page structure clearly.",
      medium: "The page structure may not be immediately clear to users.",
      low: "Users appear to notice the page structure appropriately.",
    },
  },
  interactive: {
    label: "Interactive elements",
    historyIdea: "find the next action",
    detailIdea: "find the next action",
    interpretations: {
      high: "Users may struggle to find the next action.",
      medium: "Key actions may need stronger visual cues.",
      low: "Interactive elements appear to receive appropriate attention.",
    },
  },
  main_text: {
    label: "Main text",
    historyIdea: "process key content",
    detailIdea: "process key content without missing information or extra reading effort",
    interpretations: {
      high: "Users may not process the core content effectively.",
      medium: "Users may either miss key content or spend too much effort reading.",
      low: "Users appear to process the main content within a balanced attention range.",
    },
  },
  media: {
    label: "Images/media",
    historyIdea: "avoid media distraction",
    detailIdea: "keep media attention aligned with the main task",
    interpretations: {
      high: "Media may be drawing attention away from the main task.",
      medium: "Media may be attracting attention but not necessarily supporting the task.",
      low: "Media does not appear to create a major attention risk.",
    },
  },
  navigation: {
    label: "Navigation",
    historyIdea: "stay oriented on the page",
    detailIdea: "stay oriented on the page",
    interpretations: {
      high: "Users may miss the page path or spend effort trying to find their way.",
      medium: "Users may need extra orientation before reaching the main content.",
      low: "Navigation appears visible without distracting from the main content.",
    },
  },
};

const CAPABILITY_FALLBACKS = {
  headings: "understand the page structure",
  interactive: "find the next action",
  main_text: "process key content",
  media: "stay focused on the main task",
  navigation: "stay oriented on the page",
  default: "maintain a clear task path",
};

function wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function firstSentence(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  const segment = raw.split(/[.!?]/)[0] || raw;
  return segment.replace(/\s+/g, " ").trim();
}

function fitCapabilityPhrase(driver, { detail = false } = {}, maxWords = 8) {
  const primary = firstSentence(getCapabilityPhrase(driver, { detail }));
  if (primary && wordCount(primary) <= maxWords) {
    return primary;
  }
  const fallback = firstSentence(CAPABILITY_FALLBACKS[driver?.elementType] || CAPABILITY_FALLBACKS.default);
  if (fallback && wordCount(fallback) <= maxWords) {
    return fallback;
  }
  const parts = (primary || fallback || CAPABILITY_FALLBACKS.default)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  return parts.join(" ");
}

function ensureSentence(text, fallbackText) {
  const cleaned = firstSentence(text) || firstSentence(fallbackText);
  if (!cleaned) {
    return firstSentence(fallbackText);
  }
  return `${cleaned}.`;
}

function isKnownRiskLevel(value) {
  return Object.prototype.hasOwnProperty.call(ATTENTION_RISK_ORDER, String(value || "").toLowerCase());
}

export function normalizeAttentionRiskLevel(value) {
  const riskLevel = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(ATTENTION_RISK_ORDER, riskLevel)
    ? riskLevel
    : "medium";
}

export function formatAttentionRiskLabel(riskLevel, fallback) {
  const cleanedFallback = String(fallback || "").trim();
  if (cleanedFallback) {
    return cleanedFallback;
  }
  return `${riskLevel.charAt(0).toUpperCase()}${riskLevel.slice(1)} risk`;
}

function normalizeElementType(item) {
  const rawKey = String(item?.key || item?.elementType || "").trim().toLowerCase();
  const rawLabel = String(item?.label || "").trim().toLowerCase();
  return ELEMENT_TYPE_ALIASES[rawKey] || ELEMENT_TYPE_ALIASES[rawLabel] || rawKey || rawLabel || "other";
}

function deriveRiskLevelFromShare(elementType, rawShare) {
  const share = Math.max(0, Math.min(1, Number(rawShare) || 0));
  if (elementType === "headings") {
    if (share < 0.05) return "high";
    if (share < 0.1 || share > 0.25) return "medium";
    return "low";
  }
  if (elementType === "interactive") {
    if (share >= 0.08) return "low";
    return "medium";
  }
  if (elementType === "main_text") {
    if (share < 0.2) return "high";
    if (share < 0.35 || share > 0.65) return "medium";
    return "low";
  }
  if (elementType === "media") {
    if (share > 0.25) return "high";
    if (share > 0.1) return "medium";
    return "low";
  }
  if (elementType === "navigation") {
    if (share < 0.03 || share > 0.3) return "high";
    if (share > 0.15) return "medium";
    return "low";
  }
  if (share > 0.25) return "high";
  if (share > 0.12) return "medium";
  return "low";
}

function getCapabilityPhrase(driver, { detail = false } = {}) {
  const configuredPhrase = detail ? driver?.detailIdea : driver?.idea;
  const cleanedPhrase = String(configuredPhrase || "").trim();
  if (cleanedPhrase) {
    return cleanedPhrase;
  }
  return CAPABILITY_FALLBACKS[driver?.elementType] || CAPABILITY_FALLBACKS.default;
}

export function getElementInterpretation(elementType, riskLevel, fallback = "") {
  const configured = ELEMENT_EVIDENCE_COPY[elementType]?.interpretations?.[riskLevel];
  return (
    configured ||
    String(fallback || "").trim() ||
    "Attention pattern needs checking against the page's intended user journey."
  );
}

export function getRiskDrivers(summary) {
  const items = Array.isArray(summary?.attention_summary) ? summary.attention_summary : [];
  const backendRiskItems = summary?.eye_evidence?.element_risks
    ? Object.values(summary.eye_evidence.element_risks).filter(
        (item) => item && !item.missing && isKnownRiskLevel(item.risk_level),
      )
    : [];
  const backendRisksByType = new Map(
    backendRiskItems.map((item) => [normalizeElementType({ key: item.element_type, label: item.label }), item]),
  );
  const usedBackendTypes = new Set();

  const fromSummary = items
    .map((item) => {
      const hitCount = Math.max(0, Number(item?.hit_count || 0));
      const elementType = normalizeElementType(item);
      const backendRisk = backendRisksByType.get(elementType);
      if (!hitCount && !backendRisk) {
        return null;
      }
      if (backendRisk) {
        usedBackendTypes.add(elementType);
      }
      const configured = ELEMENT_EVIDENCE_COPY[elementType];
      const riskLevel = backendRisk
        ? normalizeAttentionRiskLevel(backendRisk.risk_level)
        : item?.risk_level
          ? normalizeAttentionRiskLevel(item.risk_level)
        : deriveRiskLevelFromShare(elementType, item?.weighted_share ?? item?.share);
      return {
        elementType,
        label: configured?.label || String(backendRisk?.label || item?.label || "Other"),
        riskLevel,
        riskLabel: formatAttentionRiskLabel(riskLevel, backendRisk?.risk_label || item?.risk_label),
        interpretation: getElementInterpretation(
          elementType,
          riskLevel,
          backendRisk?.risk_reason || item?.risk_reason,
        ),
        idea: configured?.historyIdea || "",
        detailIdea: configured?.detailIdea || "",
        hitCount,
        exactHitCount: Number(backendRisk?.exact_hit_count ?? item?.exact_hit_count ?? 0) || 0,
        nearHitCount: Number(backendRisk?.near_hit_count ?? item?.near_hit_count ?? 0) || 0,
        weightedShare: Number(backendRisk?.weighted_share ?? item?.weighted_share ?? item?.share ?? 0) || 0,
        firstFixationMs: backendRisk?.first_fixation_ms ?? item?.first_fixation_ms ?? null,
      };
    })
    .filter(Boolean);

  const fromBackendOnly = backendRiskItems
    .filter((item) => !usedBackendTypes.has(normalizeElementType({ key: item.element_type, label: item.label })))
    .map((item) => {
      const elementType = normalizeElementType({ key: item.element_type, label: item.label });
      const configured = ELEMENT_EVIDENCE_COPY[elementType];
      const riskLevel = normalizeAttentionRiskLevel(item.risk_level);
      return {
        elementType,
        label: configured?.label || String(item?.label || "Other"),
        riskLevel,
        riskLabel: formatAttentionRiskLabel(riskLevel, item?.risk_label),
        interpretation: getElementInterpretation(elementType, riskLevel, item?.risk_reason),
        idea: configured?.historyIdea || "",
        detailIdea: configured?.detailIdea || "",
        hitCount: Number(item?.hit_count || 0) || 0,
        exactHitCount: Number(item?.exact_hit_count || 0) || 0,
        nearHitCount: Number(item?.near_hit_count || 0) || 0,
        weightedShare: Number(item?.weighted_share || 0) || 0,
        firstFixationMs: item?.first_fixation_ms ?? null,
      };
    });

  return [...fromSummary, ...fromBackendOnly].sort(
    (a, b) => ATTENTION_RISK_ORDER[a.riskLevel] - ATTENTION_RISK_ORDER[b.riskLevel],
  );
}

export function getOverallEvidenceRisk(elementRisks, eyeEvidence = null) {
  if (isKnownRiskLevel(eyeEvidence?.risk_level)) {
    return normalizeAttentionRiskLevel(eyeEvidence.risk_level);
  }
  if (!elementRisks.length) {
    return null;
  }
  if (elementRisks.some((item) => item.riskLevel === "high")) {
    return "high";
  }
  if (elementRisks.some((item) => item.riskLevel === "medium")) {
    return "medium";
  }
  return "low";
}

export function generateBalancedEvidenceSummary(riskDrivers, { detail = false, overallRisk = "" } = {}) {
  const drivers = Array.isArray(riskDrivers) ? riskDrivers : [];
  const highDrivers = drivers.filter((item) => item.riskLevel === "high");
  const mediumDrivers = drivers.filter((item) => item.riskLevel === "medium");
  const lowDrivers = drivers.filter((item) => item.riskLevel === "low");
  const topPriorityDriver = highDrivers[0] || mediumDrivers[0] || null;
  const firstRiskDriver = topPriorityDriver;
  const resolvedOverallRisk = overallRisk ? normalizeAttentionRiskLevel(overallRisk) : "";

  let overall = "Eye evidence is available, but detailed element risk data is limited.";
  if (resolvedOverallRisk === "high" || (!resolvedOverallRisk && highDrivers.length)) {
    overall = "Eye evidence shows clear attention risks, alongside some usable signals.";
  } else if (resolvedOverallRisk === "medium" || (!resolvedOverallRisk && mediumDrivers.length)) {
    overall = "Eye evidence shows mixed attention patterns with both strengths and risks.";
  } else if (resolvedOverallRisk === "low" || (!resolvedOverallRisk && lowDrivers.length)) {
    overall = "Eye evidence does not indicate major attention-related risks.";
  }

  const positive = lowDrivers.length
    ? `Users can ${fitCapabilityPhrase(lowDrivers[0], { detail }, 9)} with relatively stable attention.`
    : drivers.length
      ? "Some interaction patterns are stable enough to support iterative improvement."
      : "Current evidence is limited, but baseline behavior can still guide next checks.";

  const risk = firstRiskDriver
    ? `Some users may struggle to ${fitCapabilityPhrase(firstRiskDriver, { detail }, 10)}, which could affect task flow.`
    : "No dominant element-level risk appears, but attention consistency should still be monitored.";

  const priority = topPriorityDriver
    ? `Prioritize improving ${fitCapabilityPhrase(topPriorityDriver, { detail }, 10)} first to reduce cognitive friction.`
    : "Next, strengthen visual hierarchy to keep attention aligned with core tasks.";

  return {
    overall: ensureSentence(overall, "Eye evidence is available, but detailed element risk data is limited."),
    positive: ensureSentence(
      positive,
      "Current evidence is limited, but baseline behavior can still guide next checks.",
    ),
    risk: ensureSentence(
      risk,
      "No dominant element-level risk appears, but attention consistency should still be monitored.",
    ),
    priority: ensureSentence(
      priority,
      "Next, strengthen visual hierarchy to keep attention aligned with core tasks.",
    ),
  };
}

export function getHistoryEvidenceSummary(elementRisks, eyeEvidence = null) {
  if (!elementRisks.length) {
    return EYE_EVIDENCE_DETAIL_FALLBACK;
  }
  const overallRisk = getOverallEvidenceRisk(elementRisks, eyeEvidence);
  if (overallRisk === "low") {
    return "Eye evidence does not indicate major attention-related risks.";
  }
  const highDriver = elementRisks.find((item) => item.riskLevel === "high");
  if (highDriver) {
    return `Some users may struggle to ${fitCapabilityPhrase(highDriver, { detail: false }, 10)}.`;
  }
  const mediumDriver = elementRisks.find((item) => item.riskLevel === "medium");
  if (mediumDriver) {
    return `Some users may need extra support to ${fitCapabilityPhrase(mediumDriver, { detail: false }, 10)}.`;
  }
  return generateBalancedEvidenceSummary(elementRisks, {
    detail: false,
    overallRisk: overallRisk || "",
  }).overall;
}

export function getHeatmapEvidenceSummary(elementRisks, eyeEvidence = null) {
  return generateBalancedEvidenceSummary(elementRisks, {
    detail: true,
    overallRisk: eyeEvidence?.risk_level || "",
  });
}
