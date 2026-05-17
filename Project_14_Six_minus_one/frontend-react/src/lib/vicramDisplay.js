/**
 * Shared ViCRAM score + complexity band labels (aligned with dashboard + backend).
 */
export function formatVicramScoreLabel(vcs) {
  const numericVcs = Number(vcs);
  if (!Number.isFinite(numericVcs)) {
    return "";
  }
  return `Score: ${numericVcs.toFixed(2)}`;
}

export function getVicramComplexityDisplay(vcs, riskLabel = "") {
  const numericVcs = Number(vcs);
  if (!Number.isFinite(numericVcs)) {
    return {
      scoreText: "",
      complexityLevel: String(riskLabel || "").trim() || "—",
      tone: "neutral",
    };
  }

  if (numericVcs >= 7) {
    return {
      scoreText: numericVcs.toFixed(2),
      complexityLevel: "High visual complexity",
      tone: "high",
    };
  }
  if (numericVcs >= 4) {
    return {
      scoreText: numericVcs.toFixed(2),
      complexityLevel: "Moderate visual complexity",
      tone: "moderate",
    };
  }
  return {
    scoreText: numericVcs.toFixed(2),
    complexityLevel: "Low visual complexity",
    tone: "low",
  };
}
