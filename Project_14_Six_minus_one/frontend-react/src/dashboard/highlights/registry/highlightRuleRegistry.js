import { DT_TEXT_BLOCK_TAGS } from "../../detectors/dt/dtSemantics.js";
import { LC_TEXT_BLOCK_TAGS } from "../../detectors/lc/lcSemantics.js";
import { SC_TEXT_BLOCK_TAGS } from "../../detectors/sc/scSemantics.js";

import { dtHighlightRules } from "../detectors/dtHighlightRules.js";
import { lcHighlightRules } from "../detectors/lcHighlightRules.js";
import { scHighlightRules } from "../detectors/scHighlightRules.js";
import { ncHighlightRules } from "../detectors/ncHighlightRules.js";
import { phsHighlightRules } from "../detectors/phsHighlightRules.js";
import { voHighlightRules } from "../detectors/voHighlightRules.js";
import { wipHighlightRules } from "../detectors/wipHighlightRules.js";

const RULE_ID_TO_RULES_FACTORY = {
  "DT-1": () => dtHighlightRules({ DT_TEXT_BLOCK_TAGS }),
  "SC-1": () => scHighlightRules({ SC_TEXT_BLOCK_TAGS }),
  "LC-1": (ctx) => lcHighlightRules({ LC_TEXT_BLOCK_TAGS, lc1FrontendForensicEnabled: ctx?.lc1FrontendForensicEnabled }),
  "NC-1": () => ncHighlightRules(),
  "PHS-1": () => phsHighlightRules(),
  "VO-1": () => voHighlightRules(),
  "WIP-1": () => wipHighlightRules(),
};

function hasHighlightRules(ruleId) {
  return Boolean(RULE_ID_TO_RULES_FACTORY[String(ruleId || "")]);
}

function getHighlightRules(ruleId, ctx = {}) {
  const rid = String(ruleId || "");
  const factory = RULE_ID_TO_RULES_FACTORY[rid];
  return factory ? factory(ctx) : null;
}

export { getHighlightRules, hasHighlightRules };

