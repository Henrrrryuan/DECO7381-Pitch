import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { PriorityLensPanel } from "../components/dashboard/PriorityLensPanel.jsx";
import { DetectionGauge } from "../components/DetectionGauge.jsx";
import { bumpDashboardLifecycle } from "../lib/dashboardLifecycle.js";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

export function DashboardPage() {
  const lockTopNav = new URLSearchParams(window.location.search).get("from") === "history";

  const [gauge, setGauge] = useState({ detected: null });

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let legacyApi = null;
    (async () => {
      legacyApi = await import("../legacy/dashboardApp.js");
      if (cancelled) {
        return;
      }
      await legacyApi.initDashboard({
          onDetectionGaugeUpdate: (payload) => {
            if (cancelled) {
              return;
            }
            setGauge(
              payload ?? {
                detected: null,
              },
            );
          },
        });
    })();
    return () => {
      cancelled = true;
      bumpDashboardLifecycle();
      legacyApi?.notifyDashboardUnmount?.();
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
            data-accessibility-tooltip="Hide or show the left sidebar with target audience and issue summary controls."
          >
            <span className="sidebar-collapse-toggle-icon" aria-hidden="true">
              ‹
            </span>
          </button>
          <aside id="toolSidebar" className="tool-sidebar">
            <div className="tool-sidebar-inner">
              <PriorityLensPanel />

              <section
                id="vicramDashboardPanel"
                className="vicram-dashboard-panel"
                aria-label="ViCRAM visual complexity"
              />

              <DetectionGauge detected={gauge.detected} />

              <section className="sidebar-section sidebar-explanation-section">
                <div className="sidebar-explanation-content">
                  <div id="dashboardSummaryText" className="overall-summary" />
                  <section id="printSummary" className="print-summary" aria-label="Printable summary">
                    <div className="print-summary-top">
                      <div className="print-summary-copy">
                        <h3 id="printSourceName">Waiting for upload</h3>
                        <p id="printSummaryText">Run an analysis to populate the printable summary.</p>
                      </div>
                    </div>
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
                      data-accessibility-tooltip="Return to the history page without starting a new analysis."
                      hidden
                    >
                      <span aria-hidden="true">Back to History</span>
                    </button>
                    <button
                      id="printReportBtn"
                      className="context-print-button"
                      type="button"
                      title="Print current report"
                      data-accessibility-tooltip="Open the browser print dialog for the current report."
                    >
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
