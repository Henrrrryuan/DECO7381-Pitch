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
          </nav>
        </div>
      </header>

      <main className="docs-page docs-page-future">
        <section className="docs-panel docs-panel-future">
          <h1>How to use CogniLens</h1>
          <div className="docs-copy">
            <p>
              CogniLens is now a React-based workflow for checking cognitive accessibility barriers, locating the
              affected page elements, and turning each finding into a practical redesign action.
            </p>
          </div>
        </section>

        <section className="docs-timeline" aria-label="CogniLens workflow documentation">
          <div className="docs-timeline-axis" aria-hidden="true" />

          <article className="docs-card docs-card-left">
            <span className="docs-step">1</span>
            <h2>Recommended workflow</h2>
            <p>
              <strong>New Analysis</strong> -&gt; <strong>Analyze</strong> -&gt; choose a high-risk issue category -&gt; open
              an issue card -&gt; show the highlighted location -&gt; open guidance.
            </p>
            <p>Use this path to work through one issue at a time instead of reading the whole report at once.</p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">2</span>
            <h2>Start an analysis</h2>
            <p>
              On the start page, analyze a local <span className="docs-mono-tag">URL</span>,{" "}
              <span className="docs-mono-tag">HTML</span> file, or <span className="docs-mono-tag">ZIP</span> package.
            </p>
            <p>After processing, CogniLens opens the React dashboard with profile-based risk views and top issue cards.</p>
          </article>

          <article id="issue-workspace" className="docs-card docs-card-core">
            <span className="docs-step">3</span>
            <h2>Prioritize and inspect issues</h2>
            <p>
              Use <strong>High / Medium / Low risk</strong> to decide which issue category needs attention first. Risk
              labels are prioritization support, not a final accessibility grade.
            </p>
            <div className="docs-risk-row" aria-hidden="true">
              <span className="docs-risk-pill is-high">High risk</span>
              <span className="docs-risk-pill is-medium">Medium risk</span>
              <span className="docs-risk-pill is-low">Low risk</span>
            </div>
            <p>Each issue card has two clear actions:</p>
            <ul className="docs-list">
              <li>
                <strong>Show highlighted location</strong> opens the page preview and labels the affected elements.
              </li>
              <li>
                <strong>Open guidance</strong> explains the affected elements, why the issue matters, and what to change
                first.
              </li>
            </ul>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">4</span>
            <h2>Use guidance to redesign</h2>
            <p>
              In the guidance panel, review <strong>Affected elements and locations</strong>,{" "}
              <strong>Why this matters</strong>, and <strong>First redesign move</strong> in order.
            </p>
            <p>
              The WCAG / COGA and ISO mapping appears on the issue card so designers and developers can connect each
              recommendation to recognised accessibility and usability frameworks.
            </p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">5</span>
            <h2>Check the page location</h2>
            <p>
              The highlighted preview uses numbered labels such as <strong>Element 1</strong> and{" "}
              <strong>Element 2</strong>. These numbers match the affected elements listed in guidance.
            </p>
            <p>
              Use this view to verify the exact page area before redesigning, then return to guidance for the next
              action.
            </p>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">6</span>
            <h2>Use supporting tools</h2>
            <p>
              Open <strong>History</strong> to revisit saved React reports. When a report is opened from History, use{" "}
              <strong>Back to History</strong> to return to the report list.
            </p>
            <p>
              Use <strong>Eye Tracking</strong> as supporting evidence when you need to compare automated findings with
              attention or scanning behaviour.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
