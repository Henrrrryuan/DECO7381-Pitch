import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isHtmlFile, isZipFile, loadDashboardSession } from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { spaGuideLandingHref, spaLandingHistoryHref } from "../lib/siteUrls.js";

const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";
const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
const GUIDE_BUBBLE_STEPS = [
  { title: "Choose Input", body: "Paste a website URL or upload a file." },
  { title: "Pick an Audience", body: "Choose who the page is designed for first." },
  { title: "Open Issue Cards", body: "Review each finding and its evidence." },
  { title: "Use Redesign Hints", body: "Read why it matters and the first fix to try." },
  { title: "Issues Count", body: "This number lists findings, not a score." },
  { title: "More Tools", body: "Use Eye Tracking and History when you need them." },
];

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

function readFileAsDataUrl(uploadFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(uploadFile);
  });
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
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [viewedGuideSteps, setViewedGuideSteps] = useState(() => new Set([0]));

  const urlValid = useMemo(() => Boolean(String(url).trim()) && !loading, [url, loading]);
  const fileValid = useMemo(() => Boolean(file) && !loading, [file, loading]);
  const guideUnlocked = viewedGuideSteps.size >= GUIDE_BUBBLE_STEPS.length;

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
    if (!guideUnlocked) {
      return;
    }
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
    if (!guideUnlocked) {
      return;
    }
    if (!file || loading) {
      return;
    }
    setLoading(true);
    setStatusMessage("Opening the analysis progress page...");
    try {
      const previousSession = loadDashboardSession();
      const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
      const createdAt = new Date().toISOString();

      if (isZipFile(file)) {
        const fileDataUrl = await readFileAsDataUrl(file);
        savePendingAnalysis({
          mode: "file",
          sourceType: "zip",
          fileDataUrl,
          fileName: file.name,
          fileType: file.type || "application/zip",
          baselineRunId,
          createdAt,
        });
      } else {
        const html = await file.text();
        savePendingAnalysis({
          mode: "file",
          html,
          fileName: file.name,
          baselineRunId,
          createdAt,
        });
      }
      navigate("/loading");
    } catch (err) {
      const isQuota =
        err?.name === "QuotaExceededError" ||
        err?.code === 22 ||
        (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "QuotaExceededError");
      if (isQuota) {
        setStatusMessage(
          "The file is too large for the browser to stage. Try a smaller ZIP package or clear site data for this app.",
          true,
        );
      } else {
        setStatusMessage(err.message || String(err), true);
      }
      setLoading(false);
    }
  };

  const onFileInputChange = (event) => {
    if (!guideUnlocked) {
      return;
    }
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
    if (!guideUnlocked) {
      setDropDragging(false);
      return;
    }
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
  const isFinalGuideStep = guideStepIndex >= GUIDE_BUBBLE_STEPS.length - 1;

  const unlockGuide = () => {
    setViewedGuideSteps(new Set(GUIDE_BUBBLE_STEPS.map((_, index) => index)));
  };

  const onGuideNext = () => {
    if (isFinalGuideStep) {
      return;
    }
    setGuideStepIndex((prev) => {
      const next = Math.min(prev + 1, GUIDE_BUBBLE_STEPS.length - 1);
      setViewedGuideSteps((current) => {
        const updated = new Set(current);
        updated.add(next);
        return updated;
      });
      return next;
    });
  };

  const onGuideSkip = () => {
    unlockGuide();
  };

  const onGuideFinish = () => {
    unlockGuide();
  };

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
          <div className={`upload-copy${!guideUnlocked ? " guide-locked-dim" : ""}`}>
            <h1>Cognitive Accessibility Evaluation</h1>
          </div>

          <section className="input-workflow" aria-label="CogniLens input workflow">
            <div className="workflow-card">
              <aside className="upload-character-panel">
                {!guideUnlocked ? (
                <div className="guide-bubble" role="status" aria-live="polite">
                  <ul
                    className="guide-bubble-dots"
                    aria-label={`Tutorial progress, step ${guideStepIndex + 1} of ${GUIDE_BUBBLE_STEPS.length}`}
                  >
                    {GUIDE_BUBBLE_STEPS.map((_, index) => (
                      <li
                        key={index}
                        className={index <= guideStepIndex ? "is-filled" : ""}
                        aria-current={index === guideStepIndex ? "step" : undefined}
                      />
                    ))}
                  </ul>
                  <div className="guide-bubble-copy">
                    <h2 className="guide-bubble-title">{GUIDE_BUBBLE_STEPS[guideStepIndex].title}</h2>
                    <p className="guide-bubble-body">{GUIDE_BUBBLE_STEPS[guideStepIndex].body}</p>
                  </div>
                  <div className="guide-bubble-actions">
                    <button
                      type="button"
                      className="guide-bubble-skip"
                      onClick={onGuideSkip}
                      aria-label="Skip and unlock analysis"
                    >
                      Skip
                    </button>
                    {isFinalGuideStep ? (
                      <button
                        type="button"
                        className="guide-bubble-finish"
                        onClick={onGuideFinish}
                        aria-label="Finish tutorial and unlock analysis"
                      >
                        Finish &amp; Unlock
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="guide-bubble-next"
                        onClick={onGuideNext}
                        aria-label={`Go to step ${guideStepIndex + 2} of ${GUIDE_BUBBLE_STEPS.length}`}
                      >
                        Next
                      </button>
                    )}
                  </div>
                </div>
                ) : null}
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

              <div
                className={`workflow-options${!guideUnlocked ? " guide-locked-dim" : ""}`}
                role="tablist"
                aria-label="Input method"
              >
                <button
                  className={`workflow-option${isUrlWorkflow ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isUrlWorkflow}
                  aria-controls="urlForm"
                  disabled={!guideUnlocked}
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
                  disabled={!guideUnlocked}
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

              <div className={`workflow-panels${!guideUnlocked ? " guide-locked-dim" : ""}`}>
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
                      disabled={!guideUnlocked || loading}
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
                    disabled={!guideUnlocked || !urlValid}
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
                    aria-disabled={!guideUnlocked}
                    data-accessibility-tooltip="Choose or drop an HTML file or ZIP package to prepare it for analysis."
                    onDragEnter={(event) => {
                      if (!guideUnlocked) return;
                      event.preventDefault();
                      setDropDragging(true);
                    }}
                    onDragOver={(event) => {
                      if (!guideUnlocked) return;
                      event.preventDefault();
                      setDropDragging(true);
                    }}
                    onDragLeave={(event) => {
                      if (!guideUnlocked) return;
                      event.preventDefault();
                      setDropDragging(false);
                    }}
                    onDrop={onDrop}
                  >
                    <input
                      id="uploadInput"
                      type="file"
                      disabled={!guideUnlocked || loading}
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
                    disabled={!guideUnlocked || !fileValid}
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
            className={`upload-status${status.isError ? " error" : ""}${!guideUnlocked ? " guide-locked-dim" : ""}`}
            aria-live="polite"
          >
            {status.message}
          </p>
        </section>
      </main>
    </>
  );
}
