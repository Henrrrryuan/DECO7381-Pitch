import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

const STORAGE_KEY = "cognilens.return.analysis-url";

export function DocsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const source = searchParams.get("source");
    if (source == null || source === "") {
      navigate(spaGuideAnalysisHref, { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    document.body.classList.add("docs-body");
    return () => document.body.classList.remove("docs-body");
  }, []);

  const source = searchParams.get("source");
  const openedFromAnalysis = source === "analysis";

  const [returnUrl, setReturnUrl] = useState("");

  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      stored = "";
    }
    if (stored) {
      try {
        const parsedUrl = new URL(stored, window.location.href);
        if (parsedUrl.searchParams.get("from") === "history") {
          const normalized = "/dashboard";
          sessionStorage.setItem(STORAGE_KEY, normalized);
          stored = normalized;
        }
      } catch {
        // keep stored
      }
    }
    setReturnUrl(stored);
  }, []);

  const showAnalysisNav = Boolean(openedFromAnalysis && returnUrl);

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
            <Link id="landingBackButton" className="nav-cta" to="/" hidden={showAnalysisNav}>
              Back to start
            </Link>
            <Link className="active-link" to={spaGuideAnalysisHref} hidden={!showAnalysisNav} data-analysis-nav>
              Guide
            </Link>
            <a href={eyeTrackingHref} hidden={!showAnalysisNav} data-analysis-nav>
              Eye Tracking
            </a>
            <Link to={spaHistoryHref} hidden={!showAnalysisNav} data-analysis-nav>
              History
            </Link>
            <button
              id="backToAnalysisButton"
              className="nav-cta"
              type="button"
              hidden={!showAnalysisNav}
              data-analysis-nav
              onClick={() => {
                if (returnUrl) {
                  window.location.href = returnUrl;
                }
              }}
            >
              Back to analysis
            </button>
            <Link className="nav-cta" to="/" hidden={!showAnalysisNav} data-analysis-nav>
              New Analysis
            </Link>
          </nav>
        </div>
      </header>

      <main className="docs-page docs-page-future">
        <section className="docs-panel docs-panel-future">
          <h1>How to use CogniLens</h1>
          <div className="docs-copy">
            <p>
              CogniLens helps teams detect cognitive accessibility issues, inspect exactly where they appear, and turn
              findings into practical redesign actions.
            </p>
          </div>
        </section>

        <section className="docs-timeline" aria-label="CogniLens workflow documentation">
          <div className="docs-timeline-axis" aria-hidden="true" />

          <article className="docs-card docs-card-left">
            <span className="docs-step">1</span>
            <h2>Quick path</h2>
            <p>
              <strong>New Analysis</strong> -&gt; <strong>Analyze</strong> -&gt; choose a category by risk -&gt; open an
              issue card -&gt; inspect location -&gt; open guidance.
            </p>
            <p>Use this route when you want a fast first pass before deeper review.</p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">2</span>
            <h2>Start an analysis</h2>
            <p>
              Click <strong>New Analysis</strong>, then analyze a local <span className="docs-mono-tag">URL</span>,{" "}
              <span className="docs-mono-tag">HTML</span> file, or <span className="docs-mono-tag">ZIP</span> package.
            </p>
            <p>After processing, CogniLens opens the dashboard with profile-based risk views and issue cards.</p>
          </article>

          <article id="issue-workspace" className="docs-card docs-card-core">
            <span className="docs-step">3</span>
            <h2>Prioritize and inspect issues</h2>
            <p>
              Use <strong>High / Medium / Low risk</strong> to decide where to start. Risk is prioritization support,
              not a final compliance grade.
            </p>
            <div className="docs-risk-row" aria-hidden="true">
              <span className="docs-risk-pill is-high">High risk</span>
              <span className="docs-risk-pill is-medium">Medium risk</span>
              <span className="docs-risk-pill is-low">Low risk</span>
            </div>
            <p>Each Top Issue Card provides two core actions:</p>
            <ul className="docs-list">
              <li>
                <strong>Show highlighted location</strong> opens the website preview and highlights where the issue
                appears.
              </li>
              <li>
                <strong>Open guidance</strong> opens the detailed issue workspace with evidence, why it matters, and
                redesign direction.
              </li>
            </ul>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">4</span>
            <h2>Use guidance to redesign</h2>
            <p>
              In issue guidance, review <strong>Page evidence</strong>, <strong>Why this matters</strong>, and{" "}
              <strong>First redesign move</strong> in order.
            </p>
            <p>For technical implementation, use the selector details and standards mapping as your engineering checklist.</p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">5</span>
            <h2>Understand scoring signals</h2>
            <p>
              Hover the info icon beside each dimension to see <strong>what it means</strong> and{" "}
              <strong>how it is scored</strong>.
            </p>
            <p>
              Dimension scoring aligns with your cognitive risk model and maps to <span className="docs-mono-tag">WCAG</span>{" "}
              / <span className="docs-mono-tag">ISO</span>-based signals in issue details.
            </p>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">6</span>
            <h2>Use Eye Tracking and History</h2>
            <p>
              Open <strong>Eye Tracking</strong> when you need behavior evidence for attention and visual focus patterns.
            </p>
            <p>
              Use <strong>History</strong> to reopen reports, compare iterations, and continue from prior analysis runs.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
