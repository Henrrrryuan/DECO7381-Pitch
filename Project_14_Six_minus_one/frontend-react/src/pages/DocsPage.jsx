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
            <a
              className="nav-eye-tracking"
              href={eyeTrackingHref}
              hidden={!showAnalysisNav}
              data-analysis-nav
            >
              Eye Tracking
            </a>
            <Link to={spaHistoryHref} hidden={!showAnalysisNav} data-analysis-nav>
              History
            </Link>
            <button
              id="backToAnalysisButton"
              className="nav-cta nav-cta-return"
              type="button"
              hidden={!showAnalysisNav}
              data-analysis-nav
              onClick={() => {
                if (returnUrl) {
                  window.location.href = returnUrl;
                }
              }}
            >
              <span className="nav-cta-icon" aria-hidden="true">
                ←
              </span>
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
              CogniLens surfaces cognitive accessibility issues with concrete evidence so you can inspect what was
              detected, see it in context when the page supports it, and turn findings into practical redesign moves.
              The dashboard does not compute an overall accessibility score—it focuses on detected issues and their
              explanations.
            </p>
          </div>
        </section>

        <section className="docs-timeline" aria-label="CogniLens workflow documentation">
          <div className="docs-timeline-axis" aria-hidden="true" />

          <article className="docs-card docs-card-left">
            <span className="docs-step">1</span>
            <h2>Quick path</h2>
            <p>
              <strong>New Analysis</strong> → <strong>Analyze</strong> → pick a <strong>Target audience</strong> → open
              an issue in the workspace → use <strong>Element</strong> evidence (clickable chips when available) → when
              the preview opens, inspect the numbered highlight and linked guidance.
            </p>
            <p>Use this route when you want a fast first pass before deeper review.</p>
            <p className="docs-outcome">
              You should see: for many findings, <strong>Element 1</strong>, <strong>Element 2</strong>, … highlights in
              the website preview. Some evidence cannot be highlighted (for example document-level structure or autoplay
              audio)—that context stays in the issue panel instead of switching the preview.
            </p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">2</span>
            <h2>Start an analysis</h2>
            <p>
              Click <strong>New Analysis</strong>, then analyze a live <span className="docs-mono-tag">URL</span>, a
              local <span className="docs-mono-tag">HTML</span> file, or a <span className="docs-mono-tag">ZIP</span>{" "}
              package.
            </p>
            <p>
              After processing, CogniLens opens the dashboard with the <strong>Target audience</strong> selector, a
              large <strong>Detected issues</strong> count (detectors that reported at least one issue for the current
              audience), and the issue workspace.
            </p>
          </article>

          <article id="issue-workspace" className="docs-card docs-card-core">
            <span className="docs-step">3</span>
            <h2>Prioritize and inspect issues</h2>
            <p>
              Under <strong>Target audience</strong>, choose the persona you want the list oriented toward. The workspace
              reorders and filters so the most relevant detected issues surface first for that audience; the short
              profile blurb under the tabs reminds you what each persona emphasizes.
            </p>
            <div className="docs-workflow-row" aria-hidden="true">
              <span>Target audience</span>
              <span>Detected issues</span>
              <span>Element evidence</span>
            </div>
            <p>
              Expand an issue to read the explanation and evidence. Evidence appears as numbered <strong>Element</strong>{" "}
              rows (buttons when the preview can drive inspection, or static chips when highlight is not available).
            </p>
            <p>Use the evidence list to drive inspection:</p>
            <ul className="docs-list">
              <li>
                <strong>Clickable Element chips</strong> switch to the website preview when possible, scroll to the
                target, and label it with the same element number as the list. The status line under the preview explains
                loading, hidden content, or mapping limits.
              </li>
              <li>
                <strong>Non-highlightable rows</strong> (structural findings, missing visible targets, or cases like
                autoplay audio) keep you on the issue view so you can read the finding without forcing a preview reload.
              </li>
            </ul>
            <p className="docs-outcome">
              You should see: list numbers and preview labels stay aligned whenever highlighting succeeds; otherwise the
              issue text carries the usable detail.
            </p>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">4</span>
            <h2>Use guidance to redesign</h2>
            <p>
              When a highlight is active inside the embedded preview, open the guidance popover: read{" "}
              <strong>Why this matters</strong> and <strong>First redesign move</strong> in order.
            </p>
            <p>
              <strong>Hover</strong> a highlighted region for a lightweight preview of that guidance; <strong>click</strong>{" "}
              the highlight to pin the panel. Use <strong>X</strong> on the pinned popover to dismiss it. If an evidence
              row never switches to preview, rely on the issue explanation—that flow is intentional for evidence that does
              not map to a single on-page target.
            </p>
            <p className="docs-outcome">
              You should see: guidance anchored beside the highlighted element when preview inspection applies; otherwise
              full context in the issue workspace.
            </p>
          </article>

          <article className="docs-card docs-card-right">
            <span className="docs-step">5</span>
            <h2>Understand detected signals</h2>
            <p>
              The sidebar <strong>Detected issues</strong> number counts how many enabled detectors fired for the
              analyzed page under the current target audience—not a summed severity or pass/fail grade.
            </p>
            <p>
              Inside each issue, cognitive heuristics and reference tags (<span className="docs-mono-tag">WCAG</span>,{" "}
              <span className="docs-mono-tag">ISO</span>, <span className="docs-mono-tag">COGA</span> where applicable)
              appear as contextual labels; use <strong>Print</strong> in the workspace header when you need an
              issue-focused report without scores.
            </p>
          </article>

          <article className="docs-card docs-card-left">
            <span className="docs-step">6</span>
            <h2>Use Eye Tracking and History</h2>
            <p>
              Open <strong>Eye Tracking</strong> when you need behavior evidence for attention and visual focus patterns.
            </p>
            <p>
              Use <strong>History</strong> to reopen saved reports and review prior analysis runs. Saved eye evidence can
              support later review when available.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
