let _subscribers = new Set();

function forensicBusEnabled() {
  // DEV-only default; opt-in via env flag.
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_OBSERVABILITY_FORENSIC === "1");
}

function subscribeDashboardForensic(fn) {
  if (typeof fn !== "function") {
    return () => {};
  }
  _subscribers.add(fn);
  return () => unsubscribeDashboardForensic(fn);
}

function unsubscribeDashboardForensic(fn) {
  _subscribers.delete(fn);
}

function emitDashboardForensicEvent(event) {
  if (!forensicBusEnabled()) {
    return;
  }
  _subscribers.forEach((fn) => {
    try {
      fn(event);
    } catch (error) {
      // Do not break dashboard runtime due to dev forensics.
      console.warn("[Dashboard forensic bus] subscriber error:", error);
    }
  });
}

export {
  emitDashboardForensicEvent,
  forensicBusEnabled,
  subscribeDashboardForensic,
  unsubscribeDashboardForensic,
};

