import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  analyzeUploadFile,
  isHtmlFile,
  isZipFile,
  loadDashboardSession,
  saveDashboardSession,
} from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { spaGuideLandingHref, spaLandingHistoryHref } from "../lib/siteUrls.js";
import { logLineageTimeline, summarizeRun } from "../dashboard/observability/lineageTimeline.js";
import { logDtLineage } from "../dashboard/observability/dtLocationLineage.js";

const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";
const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";

function dt1FrontendForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_FORENSIC === "1");
}

function dtLocationsFromPayload(payload) {
  const dims = payload?.dimensions || payload?.result?.dimensions || payload?.analysis?.dimensions || [];
  const dtDim = Array.isArray(dims) ? dims.find((d) => d?.dimension === "Dense Text Detection") : null;
  const issues = dtDim?.issues || [];
  const issue = issues.find((i) => i?.rule_id === "DT-1") || issues[0] || null;
  const locs = issue?.locations || [];
  return Array.isArray(locs) ? locs.length : 0;
}

function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new Error("Enter a URL or local dev server address first.");
  }

  const hasHttpProtocol = /^https?:\/\//i.test(value);
  const hasOtherProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
  if (hasOtherProtocol && !hasHttpProtocol) {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  const candidateForHost = hasHttpProtocol ? value : `http://${value}`;
  let hostPart = "";
  try {
    hostPart = new URL(candidateForHost).hostname.toLowerCase();
  } catch {
    throw new Error("Enter a valid URL, for example http://127.0.0.1:5173.");
  }

  const isLocalTarget =
    hostPart === "localhost" ||
    hostPart === "0.0.0.0" ||
    hostPart === "::1" ||
    hostPart.endsWith(".local") ||
    /^127\./.test(hostPart) ||
    /^10\./.test(hostPart) ||
    /^192\.168\./.test(hostPart) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostPart);
  const withProtocol = hasHttpProtocol
    ? value
    : `${isLocalTarget ? "http" : "https"}://${value}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid URL, for example http://127.0.0.1:5173.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isParsedLocalTarget =
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (!isParsedLocalTarget) {
    throw new Error("Only local URLs are supported (127.0.0.1, localhost, or a LAN IP).");
  }

  return parsed.href;
}

function savePendingAnalysis(payload) {
  sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify(payload));
}

export function HomePage() {
  useEffect(() => {
    document.body.classList.add("upload-body");
    return () => document.body.classList.remove("upload-body");
  }, []);

  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [workflow, setWorkflow] = useState("url");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ message: "", isError: false });
  const [dropDragging, setDropDragging] = useState(false);

  const urlValid = useMemo(() => Boolean(String(url).trim()) && !loading, [url, loading]);
  const fileValid = useMemo(() => Boolean(file) && !loading, [file, loading]);

  useEffect(() => {
    const onShow = () => {
      setLoading(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EYE_TARGET_URL_STORAGE_KEY) || "";
      if (stored && !url.trim()) {
        setUrl(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const pupils = document.querySelectorAll("[data-eye-pupil]");
    if (!pupils.length) {
      return undefined;
    }
    const MAX_OFFSET = 5.5;
    const updatePupils = (clientX, clientY) => {
      pupils.forEach((pupil) => {
        const eye = pupil.parentElement;
        if (!eye) {
          return;
        }
        const rect = eye.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const angle = Math.atan2(dy, dx);
        const distance = Math.min(MAX_OFFSET, Math.hypot(dx, dy) * 0.09);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        pupil.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };
    const onMove = (event) => updatePupils(event.clientX, event.clientY);
    const onLeave = () => {
      pupils.forEach((pupil) => {
        pupil.style.transform = "translate3d(0, 0, 0)";
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useEffect(() => {
    const trimmed = String(url || "").trim();
    try {
      if (trimmed) {
        localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(EYE_TARGET_URL_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [url]);

  const setStatusMessage = (message, isError = false) => {
    setStatus({ message, isError });
  };

  const onUrlSubmit = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    let normalizedUrl;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch (err) {
      setStatusMessage(err.message, true);
      return;
    }
    setLoading(true);
    setStatusMessage("Opening the analysis progress page...");
    try {
      const previousSession = loadDashboardSession();
      const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
      try {
        localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, normalizedUrl);
      } catch {
        // ignore
      }
      savePendingAnalysis({
        mode: "url",
        url: normalizedUrl,
        baselineRunId,
        createdAt: new Date().toISOString(),
      });
      navigate("/loading");
    } catch (err) {
      setStatusMessage(err.message, true);
      setLoading(false);
    }
  };

  const onFileSubmit = async (event) => {
    event.preventDefault();
    if (!file || loading) {
      return;
    }
    setLoading(true);
    setStatusMessage("Preparing the analysis page...");
    try {
      const previousSession = loadDashboardSession();
      const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
      const payload = await analyzeUploadFile(file, baselineRunId);
      const sourceType = isZipFile(file) ? "zip" : "html";
      const sourceName = payload.resource_bundle?.entry_name || file.name;
      const sourceUrl = payload.preview_url || "";
      const html = payload.html_content || "";

      const savedAt = new Date().toISOString();
      if (dt1FrontendForensicEnabled()) {
        const runId = String(payload?.run?.run_id || payload?.run_id || "");
        console.log("[DT lineage] analyze.response", {
          sourceType,
          sourceName,
          run_id: runId,
          dt_locations: dtLocationsFromPayload(payload),
        });
      }
      logLineageTimeline("analyze.response", {
        owner: "pages/HomePage.onFileSubmit",
        sourceType,
        sourceName,
        incoming: summarizeRun(payload),
        dt_locations: dtLocationsFromPayload(payload),
      });
      logDtLineage("frontend.fetch.payload", payload, {
        owner: "pages/HomePage.onFileSubmit",
        sourceType,
        sourceName,
      });
      saveDashboardSession({
        current: {
          payload,
          html,
          sourceName,
          sourceType,
          sourceUrl,
          savedAt,
        },
        previous: previousSession?.current || null,
        html,
        sourceName,
        sourceUrl,
        savedAt,
      });
      if (dt1FrontendForensicEnabled()) {
        const stored = loadDashboardSession();
        const storedRun = String(stored?.current?.payload?.run?.run_id || stored?.current?.payload?.run_id || "");
        console.log("[DT lineage] session.persisted", {
          stored_run_id: storedRun,
          stored_sourceType: stored?.current?.sourceType || "",
          stored_sourceName: stored?.current?.sourceName || "",
        });
      }
      const stored = loadDashboardSession();
      logLineageTimeline("session.persisted", {
        owner: "pages/HomePage.onFileSubmit",
        stored: summarizeRun(stored?.current?.payload || null),
        stored_sourceType: stored?.current?.sourceType || "",
        stored_sourceName: stored?.current?.sourceName || "",
      });
      logDtLineage("frontend.session.persisted", stored?.current?.payload || null, {
        owner: "pages/HomePage.onFileSubmit",
        stored_sourceType: stored?.current?.sourceType || "",
      });
      logLineageTimeline("navigation.before", {
        owner: "pages/HomePage.onFileSubmit",
        to: "/dashboard",
        stored: summarizeRun(stored?.current?.payload || null),
      });
      navigate("/dashboard");
    } catch (err) {
      setStatusMessage(err.message, true);
      setLoading(false);
    }
  };

  const onFileInputChange = (event) => {
    const [next] = event.target.files || [];
    if (!next) {
      setFile(null);
      return;
    }
    if (!isHtmlFile(next) && !isZipFile(next)) {
      event.target.value = "";
      setFile(null);
      setStatusMessage("Only HTML and ZIP files are supported on the upload page.", true);
      return;
    }
    setFile(next);
    setStatusMessage(`${next.name} is ready for analysis.`);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDropDragging(false);
    const [dropped] = event.dataTransfer?.files || [];
    if (!dropped) {
      return;
    }
    if (!isHtmlFile(dropped) && !isZipFile(dropped)) {
      setStatusMessage("Only HTML and ZIP files are supported on the upload page.", true);
      return;
    }
    const input = document.getElementById("uploadInput");
    if (input) {
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(dropped);
        input.files = dataTransfer.files;
      } catch {
        // ignore
      }
    }
    setFile(dropped);
    setStatusMessage(`${dropped.name} is ready for analysis.`);
  };

  const isUrlWorkflow = workflow === "url";

  return (
    <>
      <AccessibilityWidgetMount />
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="app-brand" to="/">
            <span className="app-brand-mark">C</span>
            <span className="app-brand-name">CogniLens</span>
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            <Link to={spaGuideLandingHref}>Guide</Link>
            <Link to={spaLandingHistoryHref}>History</Link>
          </nav>
        </div>
      </header>

      <main className="upload-page">
        <section className="upload-hero">
          <div className="upload-copy">
            <h1>Cognitive Accessibility Evaluation</h1>
          </div>

          <section className="input-workflow" aria-label="CogniLens input workflow">
            <div className="workflow-card">
              <aside className="upload-character-panel" aria-hidden="true">
                <div className="character-stage">
                  <div className="character figure-purple">
                    <div className="character-eyes">
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                    </div>
                  </div>
                  <div className="character figure-dark">
                    <div className="character-eyes">
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                    </div>
                  </div>
                  <div className="character figure-orange">
                    <div className="character-eyes">
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                    </div>
                  </div>
                  <div className="character figure-yellow">
                    <div className="character-eyes">
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                      <span className="eye-ball">
                        <span className="eye-pupil" data-eye-pupil />
                      </span>
                    </div>
                    <span className="character-mouth" aria-hidden="true" />
                  </div>
                </div>
              </aside>

              <div className="workflow-options" role="tablist" aria-label="Input method">
                <button
                  className={`workflow-option${isUrlWorkflow ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isUrlWorkflow}
                  aria-controls="urlForm"
                  data-workflow-option="url"
                  data-accessibility-tooltip="Use this option when the page is running in a browser and can be reached by URL."
                  onClick={() => setWorkflow("url")}
                >
                  <span className="workflow-option-title">Website URL</span>
                  <span className="workflow-option-copy">
                    Analyze a local development webpage by entering its URL.
                  </span>
                </button>
                <button
                  className={`workflow-option${!isUrlWorkflow ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={!isUrlWorkflow}
                  aria-controls="uploadForm"
                  data-workflow-option="file"
                  data-accessibility-tooltip="Use this option when you want to analyze a saved HTML file or ZIP package."
                  onClick={() => {
                    setWorkflow("file");
                    setStatusMessage(file ? `${file.name} is ready for analysis.` : "");
                  }}
                >
                  <span className="workflow-option-title">Upload File</span>
                  <span className="workflow-option-copy">Check an HTML file or ZIP package from your computer.</span>
                </button>
              </div>

              <div className="workflow-panels">
                <form
                  id="urlForm"
                  className={`workflow-panel primary-input-card${isUrlWorkflow ? " is-active" : ""}`}
                  role="tabpanel"
                  data-workflow-panel="url"
                  hidden={!isUrlWorkflow}
                  noValidate
                  onSubmit={onUrlSubmit}
                >
                  <div className="input-card-copy">
                    <h3>Check a website</h3>
                    <p>
                      Prefer{" "}
                      <strong>http://127.0.0.1</strong> with your dev-server port (e.g.{" "}
                      <strong>http://127.0.0.1:5173</strong>) instead of localhost. 
                    </p>
                  </div>

                  <div className="url-input-row">
                    <input
                      id="urlInput"
                      className="url-input"
                      type="url"
                      inputMode="url"
                      placeholder="http://127.0.0.1:5173"
                      autoComplete="url"
                      data-accessibility-tooltip="Enter the full website address to analyze, including http:// or https:// and the port if needed."
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </div>

                  <button
                    id="analyzeUrlButton"
                    className="upload-analyze-button"
                    type="submit"
                    disabled={!urlValid}
                    data-accessibility-tooltip="Start analyzing this website URL and open the cognitive accessibility report."
                  >
                    {loading && isUrlWorkflow ? "Analyzing..." : "Analyze"}
                  </button>
                </form>

                <form
                  id="uploadForm"
                  className={`workflow-panel upload-form secondary-upload-card${!isUrlWorkflow ? " is-active" : ""}`}
                  role="tabpanel"
                  data-workflow-panel="file"
                  hidden={isUrlWorkflow}
                  noValidate
                  onSubmit={onFileSubmit}
                >
                  <div className="input-card-copy">
                    <h3>Check a file</h3>
                    <p>Upload an HTML file or a ZIP package when you do not have a live page.</p>
                  </div>

                  <label
                    id="dropzone"
                    className={`dropzone${dropDragging ? " dragging" : ""}`}
                    htmlFor="uploadInput"
                    data-accessibility-tooltip="Choose or drop an HTML file or ZIP package to prepare it for analysis."
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDropDragging(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropDragging(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDropDragging(false);
                    }}
                    onDrop={onDrop}
                  >
                    <input
                      id="uploadInput"
                      type="file"
                      accept=".html,.htm,text/html,.zip,application/zip"
                      data-accessibility-tooltip="Select an HTML file or ZIP package from your computer."
                      onChange={onFileInputChange}
                    />
                    <span className="dropzone-label">Drag &amp; drop an HTML or ZIP file</span>
                    <span id="selectedFileName" className="dropzone-file">
                      {file ? file.name : "or choose an HTML / ZIP file"}
                    </span>
                  </label>

                  <button
                    id="analyzeButton"
                    className="upload-analyze-button secondary-action"
                    type="submit"
                    disabled={!fileValid}
                    data-accessibility-tooltip="Start analyzing the selected file and open the cognitive accessibility report."
                  >
                    {loading && !isUrlWorkflow ? "Analyzing..." : "Analyze"}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <p
            id="uploadStatus"
            className={`upload-status${status.isError ? " error" : ""}`}
            aria-live="polite"
          >
            {status.message}
          </p>
        </section>
      </main>
    </>
  );
}
