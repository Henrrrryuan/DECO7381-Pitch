import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

export function DashboardPage() {
  const lockTopNav = new URLSearchParams(window.location.search).get("from") === "history";

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const module = await import("../legacy/dashboardApp.js");
      if (!cancelled) {
        await module.initDashboard();
      }
    })();
    return () => {
      cancelled = true;
      import("../legacy/dashboardApp.js").then((module) => {
        module.notifyDashboardUnmount();
      });
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
            {lockTopNav ? (
              <>
                <span className="disabled-nav-link" aria-disabled="true">
                  Guide
                </span>
                <span className="disabled-nav-link" aria-disabled="true">
                  Eye Tracking
                </span>
                <span className="disabled-nav-link" aria-disabled="true">
                  History
                </span>
                <span className="nav-cta disabled-nav-link" aria-disabled="true">
                  New Analysis
                </span>
              </>
            ) : (
              <>
                <Link to={spaGuideAnalysisHref}>Guide</Link>
                <a className="nav-eye-tracking" href={eyeTrackingHref}>
                  Eye Tracking
                </a>
                <Link to={spaHistoryHref}>History</Link>
                <Link className="nav-cta" to="/">
                  New Analysis
                </Link>
              </>
            )}
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
              <section className="patient-profile-panel" aria-label="Patient profile">
                <div className="patient-profile-heading">
                  <span>Patient profile</span>
                  <strong>Priority lens</strong>
                </div>
                <div className="patient-profile-tabs" role="group" aria-label="Choose patient profile">
                  <button type="button" className="patient-profile-tab is-active" data-patient-profile="Alison" aria-pressed="true">
                    Alison
                  </button>
                  <button type="button" className="patient-profile-tab" data-patient-profile="Amy" aria-pressed="false">
                    Amy
                  </button>
                  <button type="button" className="patient-profile-tab" data-patient-profile="Tal" aria-pressed="false">
                    Tal
                  </button>
                  <button type="button" className="patient-profile-tab" data-patient-profile="Yuki" aria-pressed="false">
                    Yuki
                  </button>
                </div>
                <p id="patientProfileSummary" className="patient-profile-summary">
                  <strong>Mild cognitive impairment</strong>
                  <span>Needs familiar controls, clear navigation, low clutter, and forgiving task flow.</span>
                </p>
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

            </section>
          </section>
        </div>
      </main>
    </>
  );
}
