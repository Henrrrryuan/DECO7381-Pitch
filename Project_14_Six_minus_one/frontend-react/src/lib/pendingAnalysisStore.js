const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
const MEMORY_TOKEN_PREFIX = "memory:";

let memoryPendingAnalysis = null;

function createMemoryToken() {
  const random = Math.random().toString(36).slice(2);
  return `${MEMORY_TOKEN_PREFIX}${Date.now().toString(36)}-${random}`;
}

function isMemoryPointer(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.memoryToken === "string"
      && value.memoryToken.startsWith(MEMORY_TOKEN_PREFIX),
  );
}

function savePendingAnalysis(payload) {
  memoryPendingAnalysis = null;
  try {
    sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify(payload));
    return;
  } catch (error) {
    const token = createMemoryToken();
    memoryPendingAnalysis = { token, payload };
    try {
      sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify({ memoryToken: token }));
      return;
    } catch {
      memoryPendingAnalysis = null;
      throw error;
    }
  }
}

function loadPendingAnalysis() {
  const raw = sessionStorage.getItem(PENDING_ANALYSIS_STORAGE_KEY);
  if (!raw) {
    throw new Error("No pending analysis was found. Start a new analysis first.");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingAnalysis();
    throw new Error("The pending analysis could not be read. Start a new analysis again.");
  }
  if (isMemoryPointer(parsed)) {
    if (memoryPendingAnalysis?.token === parsed.memoryToken) {
      return memoryPendingAnalysis.payload;
    }
    clearPendingAnalysis();
    throw new Error("The staged upload is no longer available. Choose the file and start analysis again.");
  }
  return parsed;
}

function clearPendingAnalysis() {
  memoryPendingAnalysis = null;
  sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
}

export {
  PENDING_ANALYSIS_STORAGE_KEY,
  clearPendingAnalysis,
  loadPendingAnalysis,
  savePendingAnalysis,
};
