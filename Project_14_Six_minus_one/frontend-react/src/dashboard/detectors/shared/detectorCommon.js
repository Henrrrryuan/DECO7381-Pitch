function titleCaseSelectorPart(value) {
  return String(value || "")
    .replace(/^[.#]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bcta\b/gi, "CTA")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function controlElementLabel(tag) {
  const normalizedTag = String(tag || "").toLowerCase();
  if (normalizedTag === "a") {
    return "Link";
  }
  if (normalizedTag === "input") {
    return "Input button";
  }
  if (normalizedTag === "button") {
    return "Button";
  }
  return titleCaseSelectorPart(normalizedTag || "Control");
}

function scParseMetricNumber(value) {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

export {
  controlElementLabel,
  scParseMetricNumber,
  titleCaseSelectorPart,
};

