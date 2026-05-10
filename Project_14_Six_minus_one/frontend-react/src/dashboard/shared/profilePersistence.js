const ACTIVE_PROFILE_STORAGE_KEY = "cognilens.active-profile";

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}

function readPersistedActiveProfile() {
  const fromSession = safeGet(sessionStorage, ACTIVE_PROFILE_STORAGE_KEY);
  if (fromSession) {
    return String(fromSession);
  }
  const fromLocal = safeGet(localStorage, ACTIVE_PROFILE_STORAGE_KEY);
  return fromLocal ? String(fromLocal) : "";
}

function persistActiveProfile(profileName) {
  const value = String(profileName || "").trim();
  if (!value) {
    return { persisted: false };
  }
  const sessionOk = safeSet(sessionStorage, ACTIVE_PROFILE_STORAGE_KEY, value);
  const localOk = safeSet(localStorage, ACTIVE_PROFILE_STORAGE_KEY, value);
  return { persisted: sessionOk || localOk, sessionOk, localOk };
}

export {
  ACTIVE_PROFILE_STORAGE_KEY,
  persistActiveProfile,
  readPersistedActiveProfile,
};

