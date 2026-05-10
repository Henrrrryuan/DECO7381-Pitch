function eiSubtypeLabel(interruptType) {
  const key = String(interruptType || "").trim() || "other";
  const labels = {
    modal: "Modal Interruptions",
    consent: "Cookie / Consent",
    chat: "Chat / Sticky Widgets",
    notification: "Notifications / Toasts",
    script: "Scripted Interruptions",
    other: "Other Interruptions",
  };
  return labels[key] || labels.other;
}

function eiSubtypeOrder(interruptType) {
  const label = eiSubtypeLabel(interruptType);
  const order = {
    "Modal Interruptions": 1,
    "Cookie / Consent": 2,
    "Chat / Sticky Widgets": 3,
    "Notifications / Toasts": 4,
    "Scripted Interruptions": 5,
    "Other Interruptions": 6,
  };
  return order[label] || 99;
}

function groupEiLocationsBySubtype(locations) {
  const groups = {};
  if (!Array.isArray(locations)) return groups;
  locations.forEach((location, index) => {
    const raw = String(location?.interrupt_type || location?.interruptType || "").trim();
    const key = raw || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push({ location, elementNumber: index + 1 });
  });
  return groups;
}

export { eiSubtypeLabel, eiSubtypeOrder, groupEiLocationsBySubtype };

