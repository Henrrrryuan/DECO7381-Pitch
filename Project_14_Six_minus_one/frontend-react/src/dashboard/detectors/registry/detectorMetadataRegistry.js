import { dtMetadata } from "../dt/dtMetadata.js";
import { lcMetadata } from "../lc/lcMetadata.js";
import { scMetadata } from "../sc/scMetadata.js";
import { ncMetadata } from "../nc/ncMetadata.js";
import { lccMetadata } from "../lcc/lccMetadata.js";
import { phsMetadata } from "../phs/phsMetadata.js";
import { voMetadata } from "../vo/voMetadata.js";
import { wipMetadata } from "../wip/wipMetadata.js";
import { amcMetadata } from "../amc/amcMetadata.js";
import { eiMetadata } from "../ei/eiMetadata.js";

const RULE_ID_TO_METADATA = {
  "DT-1": dtMetadata,
  "LC-1": lcMetadata,
  "SC-1": scMetadata,
  "NC-1": ncMetadata,
  "LCC-1": lccMetadata,
  "PHS-1": phsMetadata,
  "VO-1": voMetadata,
  "WIP-1": wipMetadata,
  "AMC-1": amcMetadata,
  "EI-1": eiMetadata,
};

function metadataForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_METADATA_FORENSIC === "1");
}

function hasDetectorMetadata(ruleId) {
  return Boolean(RULE_ID_TO_METADATA[String(ruleId || "")]);
}

function getDetectorMetadata(ruleId) {
  const rid = String(ruleId || "");
  const meta = RULE_ID_TO_METADATA[rid] || null;
  if (metadataForensicEnabled()) {
    console.log("[Detector metadata migration]", {
      detector: rid,
      metadata_registry_integrated: Boolean(meta),
      legacy_metadata_removed: null,
      remaining_legacy_tables: [],
      metadata_keys: meta ? Object.keys(meta) : [],
      unresolved_metadata_accesses: meta ? [] : [rid],
    });
  }
  return meta;
}

function getDetectorMetadataByDimensionName(dimensionName) {
  const target = String(dimensionName || "");
  return Object.values(RULE_ID_TO_METADATA).find((meta) => String(meta?.dimension || "") === target) || null;
}

export {
  getDetectorMetadata,
  getDetectorMetadataByDimensionName,
  hasDetectorMetadata,
};

