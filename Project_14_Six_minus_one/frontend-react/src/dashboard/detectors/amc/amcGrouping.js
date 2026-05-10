function amcSubtypeLabel(subtype) {
  const st = String(subtype || "");
  const labels = {
    autoplay_video: "Autoplay Media",
    autoplay_audio: "Autoplay Media",
    autoplay_iframe: "Autoplay Media",
    autoplay_script: "Autoplay Media",
    autoplay_media: "Autoplay Media",
    distracting_animation: "Distracting Animations",
    moving_region: "Moving Regions",
    carousel_motion: "Carousel Motion",
    other_motion: "Other Motion",
  };
  return labels[st] || "Other Motion";
}

function amcSubtypeOrder(subtype) {
  const bucket = amcSubtypeLabel(subtype);
  const order = {
    "Autoplay Media": 1,
    "Distracting Animations": 2,
    "Moving Regions": 3,
    "Carousel Motion": 4,
    "Other Motion": 5,
  };
  return order[bucket] || 99;
}

function groupAmcLocationsBySubtype(locations) {
  const groups = {};
  if (!Array.isArray(locations)) return groups;
  locations.forEach((location, index) => {
    const subtype = String(location?.movement_subtype || location?.movementSubtype || "").trim() || "other_motion";
    if (!groups[subtype]) groups[subtype] = [];
    groups[subtype].push({ location, elementNumber: index + 1 });
  });
  return groups;
}

export { amcSubtypeLabel, amcSubtypeOrder, groupAmcLocationsBySubtype };

