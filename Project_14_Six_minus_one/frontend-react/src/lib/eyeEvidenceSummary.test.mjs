import assert from "node:assert/strict";
import {
  generateBalancedEvidenceSummary,
  getHistoryEvidenceSummary,
  getRiskDrivers,
} from "./eyeEvidenceSummary.js";

function wordCount(sentence) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function assertSummaryShape(summary) {
  for (const key of ["overall", "positive", "risk", "priority"]) {
    assert.equal(typeof summary[key], "string");
    assert.ok(summary[key].trim(), `${key} should be non-empty`);
    assert.ok(wordCount(summary[key]) <= 22, `${key} should stay concise`);
  }
}

const mixedSummary = generateBalancedEvidenceSummary(
  [
    {
      elementType: "headings",
      label: "Headings",
      riskLevel: "high",
      riskLabel: "High risk",
      interpretation: "Users may not notice the page structure clearly.",
      idea: "understand the structure",
      detailIdea: "understand the page structure",
    },
    {
      elementType: "navigation",
      label: "Navigation",
      riskLevel: "low",
      riskLabel: "Low risk",
      interpretation: "Navigation appears visible without distracting from the main content.",
      idea: "stay oriented on the page",
      detailIdea: "stay oriented on the page",
    },
  ],
  { detail: false },
);
assertSummaryShape(mixedSummary);
assert.ok(mixedSummary.positive.includes("Users can"));
assert.ok(mixedSummary.risk.includes("Some users may struggle"));

const allLowSummary = generateBalancedEvidenceSummary(
  [
    {
      elementType: "interactive",
      label: "Interactive elements",
      riskLevel: "low",
      riskLabel: "Low risk",
      interpretation: "Interactive elements appear to receive appropriate attention.",
      idea: "find the next action",
      detailIdea: "find the next action",
    },
  ],
  { detail: false },
);
assertSummaryShape(allLowSummary);
assert.equal(allLowSummary.overall, "Eye evidence does not indicate major attention-related risks.");
assert.equal(
  allLowSummary.risk,
  "No dominant element-level risk appears, but attention consistency should still be monitored.",
);

const emptySummary = generateBalancedEvidenceSummary([], { detail: false });
assertSummaryShape(emptySummary);

const unknownSummary = generateBalancedEvidenceSummary(
  [
    {
      elementType: "custom_region",
      label: "Custom region",
      riskLevel: "high",
      riskLabel: "High risk",
      interpretation: "Attention needs checking.",
      idea: "",
      detailIdea: "",
    },
  ],
  { detail: false },
);
assertSummaryShape(unknownSummary);
assert.ok(unknownSummary.risk.includes("maintain a clear task path"));

const historyModeSummary = generateBalancedEvidenceSummary(
  [
    {
      elementType: "headings",
      label: "Headings",
      riskLevel: "high",
      riskLabel: "High risk",
      interpretation: "Users may not notice the page structure clearly.",
      idea: "understand the structure",
      detailIdea: "understand the page structure",
    },
  ],
  { detail: false },
);
const detailModeSummary = generateBalancedEvidenceSummary(
  [
    {
      elementType: "headings",
      label: "Headings",
      riskLevel: "high",
      riskLabel: "High risk",
      interpretation: "Users may not notice the page structure clearly.",
      idea: "understand the structure",
      detailIdea: "understand the page structure",
    },
  ],
  { detail: true },
);
assert.ok(historyModeSummary.risk.includes("understand the structure"));
assert.ok(detailModeSummary.risk.includes("understand the page structure"));

const compactLowSummary = getHistoryEvidenceSummary(
  [
    {
      elementType: "interactive",
      label: "Interactive elements",
      riskLevel: "medium",
      riskLabel: "Medium risk",
      interpretation: "Key actions may need stronger visual cues.",
      idea: "find the next action",
      detailIdea: "find the next action",
    },
  ],
  { risk_level: "low" },
);
assert.equal(compactLowSummary, "Eye evidence does not indicate major attention-related risks.");

const compactMediumSummary = getHistoryEvidenceSummary(
  [
    {
      elementType: "interactive",
      label: "Interactive elements",
      riskLevel: "medium",
      riskLabel: "Medium risk",
      interpretation: "Key actions may need stronger visual cues.",
      idea: "find the next action",
      detailIdea: "find the next action",
    },
    {
      elementType: "main_text",
      label: "Main text",
      riskLevel: "medium",
      riskLabel: "Medium risk",
      interpretation: "Users may either miss key content or spend too much effort reading.",
      idea: "process key content",
      detailIdea: "process key content",
    },
  ],
  { risk_level: "medium" },
);
assert.equal(compactMediumSummary, "Some users may need extra support to find the next action.");

const weightedDrivers = getRiskDrivers({
  attention_summary: [
    {
      key: "interactive",
      label: "Interactive elements",
      hit_count: 8,
      share: 0.03,
      weighted_share: 0.13,
    },
  ],
});
assert.equal(weightedDrivers[0].riskLevel, "low");

const backendAlignedDrivers = getRiskDrivers({
  attention_summary: [
    {
      key: "interactive",
      label: "Interactive elements",
      hit_count: 1,
      risk_level: "high",
      risk_label: "High risk",
      weighted_share: 0.049,
    },
  ],
  eye_evidence: {
    element_risks: {
      interactive: {
        element_type: "interactive",
        label: "Interactive elements",
        risk_level: "medium",
        risk_label: "Medium risk",
        risk_reason: "Key actions may need stronger visual cues.",
        exact_hit_count: 0,
        near_hit_count: 1,
        weighted_share: 0.049,
      },
      media: {
        element_type: "media",
        label: "Images/media",
        risk_level: "unknown",
        missing: true,
      },
    },
  },
});
assert.equal(backendAlignedDrivers.length, 1);
assert.equal(backendAlignedDrivers[0].riskLevel, "medium");
assert.equal(backendAlignedDrivers[0].nearHitCount, 1);

console.log("eyeEvidenceSummary tests passed");
