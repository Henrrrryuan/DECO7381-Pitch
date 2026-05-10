import * as dt from "../dt/dtSemantics.js";
import * as sc from "../sc/scSemantics.js";
import * as lc from "../lc/lcSemantics.js";
import * as nc from "../nc/ncSemantics.js";
import * as lcc from "../lcc/lccSemantics.js";
import * as amc from "../amc/amcSemantics.js";
import * as ei from "../ei/eiSemantics.js";

const RULE_ID_TO_MODULE = {
  "DT-1": dt,
  "SC-1": sc,
  "LC-1": lc,
  "NC-1": nc,
  "LCC-1": lcc,
  "AMC-1": amc,
  "EI-1": ei,
};

function registryForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DETECTOR_REGISTRY_FORENSIC === "1");
}

function hasDetectorSemanticModule(ruleId) {
  return Boolean(RULE_ID_TO_MODULE[String(ruleId || "")]);
}

function getDetectorSemanticModule(ruleId) {
  const rid = String(ruleId || "");
  const mod = RULE_ID_TO_MODULE[rid] || null;
  if (registryForensicEnabled()) {
    console.log("[Detector registry]", { rule_id: rid, semantic_module: mod ? rid : null });
  }
  return mod;
}

export {
  getDetectorSemanticModule,
  hasDetectorSemanticModule,
};

