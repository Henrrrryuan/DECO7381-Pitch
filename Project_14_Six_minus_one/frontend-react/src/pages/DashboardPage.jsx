import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { PriorityLensPanel } from "../components/dashboard/PriorityLensPanel.jsx";
import { DetectionGauge } from "../components/DetectionGauge.jsx";
import { bumpDashboardLifecycle } from "../lib/dashboardLifecycle.js";
import { eyeTrackingHref, spaHistoryHref } from "../lib/siteUrls.js";

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
            <img className="app-brand-mark" src="/logo-mascot.png" alt="CogniLens mascot" />
            <span className="app-brand-name">CogniLens</span>
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            {lockTopNav ? (
              <>
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
          <aside id="toolSidebar" className="tool-sidebar" data-sidebar-detail-mode="vcs">
            <div className="tool-sidebar-inner">
              <section className="sidebar-detail-panel sidebar-detail-panel-vcs" data-sidebar-panel="vcs" aria-label="ViCRAM details">
                <div className="sidebar-detail-scroll">
                  <div className="sidebar-detail-heading">
                    <p className="sidebar-detail-kicker">Visual complexity</p>
                  </div>
                  <section
                    id="vicramDashboardPanel"
                    className="vicram-dashboard-panel"
                    aria-label="ViCRAM visual complexity"
                  />
                </div>
                <button
                  id="sidebarIssuesPanelButton"
                  className="sidebar-panel-switch sidebar-panel-nav sidebar-panel-nav-next sidebar-panel-switch-bottom"
                  type="button"
                  data-sidebar-panel-target="issues"
                  aria-label="Next section: Issue Findings. Page 1 of 2."
                  data-accessibility-tooltip="Open Issue Findings: choose a target audience and review detected issue categories for this analysis."
                >
                  <span className="sidebar-panel-nav-page">Page 1 of 2</span>
                  <span className="sidebar-panel-nav-kicker">Next section</span>
                  <span className="sidebar-panel-nav-title">Issue Findings</span>
                  <span className="sidebar-panel-switch-icon sidebar-panel-switch-icon-down" aria-hidden="true" />
                </button>
              </section>

              <section className="sidebar-detail-panel sidebar-detail-panel-issues" data-sidebar-panel="issues" aria-label="Detected issue details">
                <button
                  id="sidebarVcsPanelButton"
                  className="sidebar-panel-switch sidebar-panel-nav sidebar-panel-nav-prev sidebar-panel-switch-top"
                  type="button"
                  data-sidebar-panel-target="vcs"
                  aria-label="Previous section: Visual Complexity. Page 2 of 2."
                  data-accessibility-tooltip="Return to Visual Complexity: page-level ViCRAM score and grid overview, independent of audience profile."
                >
                  <span className="sidebar-panel-nav-page">Page 2 of 2</span>
                  <span className="sidebar-panel-switch-icon sidebar-panel-switch-icon-up" aria-hidden="true" />
                  <span className="sidebar-panel-nav-kicker">Previous section</span>
                  <span className="sidebar-panel-nav-title">Visual Complexity</span>
                </button>

                <PriorityLensPanel />

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
