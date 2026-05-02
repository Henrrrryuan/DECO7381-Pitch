import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref } from "../lib/siteUrls.js";

export function DashboardPage() {
  useEffect(() => {
    document.body.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { initDashboard } = await import("../legacy/dashboardApp.js");
      if (!cancelled) {
        await initDashboard();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            <Link to="/docs?source=analysis">Guide</Link>
            <a href={eyeTrackingHref}>Eye Tracking</a>
            <Link to="/history">History</Link>
            <Link className="nav-cta" to="/">
              New Analysis
            </Link>
          </nav>
        </div>
      </header>

      <main className="tool-shell">
        <div className="tool-sidebar-shell">
          <button
            id="sidebarToggleButton"
            className="sidebar-collapse-toggle"
            type="button"
            aria-controls="toolSidebar"
            aria-expanded="true"
            aria-label="Collapse sidebar"
          >
            <span className="sidebar-collapse-toggle-icon" aria-hidden="true">
              ‹
            </span>
          </button>
          <aside id="toolSidebar" className="tool-sidebar">
            <div className="tool-sidebar-inner">
              <section className="overall-panel">
                <div className="overall-copy">
                  <div id="profileScores" className="profile-scores">
                    <p className="profile-scores-empty">Score lenses will appear after analysis.</p>
                  </div>
                  <p className="risk-level-hint">Risk levels indicate which issue categories may need attention first.</p>
                  <div id="dimensionBars" className="dimension-bars" />
                </div>
              </section>

              <section className="sidebar-section sidebar-explanation-section">
                <div className="pane-header">
                  <h2>Top Issue Cards</h2>
                </div>
                <div className="sidebar-explanation-content">
                  <div id="dashboardSummaryText" className="overall-summary" />
                  <section id="printSummary" className="print-summary" aria-label="Printable summary">
                    <div className="print-summary-top">
                      <div className="print-summary-score">
                        <span className="print-summary-score-label">Overall</span>
                        <strong id="printOverallScore">-</strong>
                      </div>
                      <div className="print-summary-copy">
                        <h3 id="printSourceName">Waiting for upload</h3>
                        <p id="printSummaryText">Run an analysis to populate the printable summary.</p>
                      </div>
                    </div>
                    <div id="printDimensionSummary" className="print-dimension-summary" />
                  </section>
                  <section id="printProfileReport" className="print-profile-report" aria-label="Printable profile report" />
                  <div id="explanationContent" className="pane-scroll rich-text empty">
                    Analysis explanations will appear here after the current page is processed.
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>

        <div className="tool-workspace-shell">
          <section className="tool-workspace">
            <section className="workspace-panels">
              <article className="workspace-pane explanation-pane">
                <div className="pane-header pane-header-actions-right">
                  <h2 className="visually-hidden">Issue workspace actions</h2>
                  <div className="report-id-chip" aria-label="Report ID">
                    <span>Report ID</span>
                    <strong id="reportIdValue">-</strong>
                  </div>
                  <div className="pane-header-actions">
                    <button
                      id="backToHistoryButton"
                      className="context-print-button back-to-history-button"
                      type="button"
                      hidden
                    >
                      <span aria-hidden="true">Back to History</span>
                    </button>
                    <button id="printReportBtn" className="context-print-button" type="button" title="Print current report">
                      <span aria-hidden="true">Print</span>
                    </button>
                  </div>
                </div>
                <div id="explanationView" className="workspace-view is-active">
                  <section className="sidebar-section comparison-section comparison-section-inline">
                    <div id="comparisonList" className="comparison-list empty">
                      Issue guidance will appear here after analysis.
                    </div>
                  </section>
                </div>

                <div id="websiteView" className="workspace-view website-preview-view" hidden>
                  <iframe
                    id="websitePreviewFrame"
                    className="website-preview-frame"
                    title="Analyzed website preview"
                  />
                </div>
              </article>

              <article
                id="assistantFloatingWindow"
                className="workspace-pane suggestion-pane assistant-floating-window"
                aria-label="AI Assistant"
                hidden
              >
                <div id="assistantDragHandle" className="pane-header assistant-floating-header">
                  <h2>AI Assistant</h2>
                  <div className="assistant-header-actions">
                    <button id="clearAssistantButton" className="assistant-clear-button" type="button">
                      Clear
                    </button>
                    <button id="assistantMinimizeButton" className="assistant-clear-button" type="button">
                      Minimize
                    </button>
                  </div>
                </div>
                <div id="assistantMessages" className="assistant-messages" aria-live="polite">
                  <article className="assistant-message assistant-message-assistant">
                    <p>Ask me how to reduce information overload, improve readability, or fix specific issues.</p>
                  </article>
                </div>
                <form id="assistantForm" className="assistant-input-area">
                  <input
                    id="assistantInput"
                    className="assistant-input"
                    type="text"
                    placeholder="Ask how to improve this page…"
                    autoComplete="off"
                  />
                  <button id="assistantSendButton" className="assistant-send-button" type="submit">
                    Send
                  </button>
                </form>
              </article>
            </section>
          </section>
        </div>
      </main>

      <button
        id="assistantFloatingButton"
        className="assistant-floating-button"
        type="button"
        aria-controls="assistantFloatingWindow"
        aria-expanded="false"
      >
        <span>AI</span>
        <strong>Assistant</strong>
      </button>
    </>
  );
}
