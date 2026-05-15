import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { analyzeVicramUrl } from "../lib/common.js";

const DEFAULT_URL = "https://www.site-example.com/text.html";

function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new Error("Enter a URL first.");
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function numberOrDefault(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function VicramPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [rows, setRows] = useState(20);
  const [columns, setColumns] = useState(20);
  const [viewportWidth, setViewportWidth] = useState(1366);
  const [viewportHeight, setViewportHeight] = useState(768);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const screenshotSrc = useMemo(() => {
    const encoded = result?.artifacts?.screenshot_png_base64;
    return encoded ? `data:image/png;base64,${encoded}` : "";
  }, [result]);

  const overlaySrc = useMemo(() => {
    const encoded = result?.artifacts?.overlay_svg_base64;
    return encoded ? `data:image/svg+xml;base64,${encoded}` : "";
  }, [result]);

  const cells = result?.grid?.cells || [];
  const activeCells = cells.filter(
    (cell) => Number(cell.word_count) > 0 || Number(cell.images) > 0 || Number(cell.tlc) > 0,
  );
  const topCells = [...activeCells].sort((a, b) => Number(b.vcs) - Number(a.vcs)).slice(0, 8);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = await analyzeVicramUrl(normalizeUrl(url), {
        rows: numberOrDefault(rows, 20),
        columns: numberOrDefault(columns, 20),
        viewportWidth: numberOrDefault(viewportWidth, 1366),
        viewportHeight: numberOrDefault(viewportHeight, 768),
      });
      setResult(payload);
    } catch (err) {
      setError(err.message || "ViCRAM analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="app-brand" to="/">
            <span className="app-brand-mark">C</span>
            <span className="app-brand-name">CogniLens</span>
          </Link>
          <nav className="app-nav-links" aria-label="Primary">
            <Link to="/">Analyze</Link>
            <Link className="active-link" to="/vicram">ViCRAM</Link>
            <Link to="/history">History</Link>
          </nav>
        </div>
      </header>

      <main className="vicram-page">
        <section className="vicram-header">
          <div>
            <h1>ViCRAM Visual Complexity</h1>
            <p>Render a webpage, calculate page and grid complexity, and inspect the coloured overlay.</p>
          </div>
        </section>

        <form className="vicram-panel vicram-form" onSubmit={onSubmit}>
          <label className="vicram-field vicram-url-field">
            <span>URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={DEFAULT_URL} />
          </label>
          <label className="vicram-field">
            <span>Rows</span>
            <input type="number" min="2" max="50" value={rows} onChange={(event) => setRows(event.target.value)} />
          </label>
          <label className="vicram-field">
            <span>Columns</span>
            <input type="number" min="2" max="50" value={columns} onChange={(event) => setColumns(event.target.value)} />
          </label>
          <label className="vicram-field">
            <span>Viewport W</span>
            <input
              type="number"
              min="320"
              max="2400"
              value={viewportWidth}
              onChange={(event) => setViewportWidth(event.target.value)}
            />
          </label>
          <label className="vicram-field">
            <span>Viewport H</span>
            <input
              type="number"
              min="320"
              max="2000"
              value={viewportHeight}
              onChange={(event) => setViewportHeight(event.target.value)}
            />
          </label>
          <button className="vicram-submit" type="submit" disabled={loading}>
            {loading ? "Analyzing..." : "Run ViCRAM"}
          </button>
        </form>

        {error ? <p className="vicram-error">{error}</p> : null}

        {result ? (
          <section className="vicram-results">
            <div className="vicram-metrics">
              <article className="vicram-metric">
                <span>Page VCS</span>
                <strong>{Number(result.page?.vcs || 0).toFixed(4)}</strong>
              </article>
              <article className="vicram-metric">
                <span>Words</span>
                <strong>{result.page?.word_count ?? 0}</strong>
              </article>
              <article className="vicram-metric">
                <span>Images</span>
                <strong>{result.page?.images ?? 0}</strong>
              </article>
              <article className="vicram-metric">
                <span>TLC</span>
                <strong>{result.page?.tlc ?? 0}</strong>
              </article>
            </div>

            <section className="vicram-panel">
              <div className="vicram-section-title">
                <h2>Screenshot Overlay</h2>
                <span>
                  {result.grid?.rows} x {result.grid?.columns} grid
                </span>
              </div>
              <div className="vicram-overlay-frame">
                <div
                  className="vicram-overlay-stage"
                  style={{
                    aspectRatio: `${result.page?.width || 1} / ${result.page?.height || 1}`,
                  }}
                >
                  <img src={screenshotSrc} alt="Rendered page screenshot" />
                  <img src={overlaySrc} alt="ViCRAM grid overlay" />
                </div>
              </div>
            </section>

            <section className="vicram-grid-split">
              <article className="vicram-panel">
                <div className="vicram-section-title">
                  <h2>Highest Grid Cells</h2>
                  <span>{activeCells.length} active cells</span>
                </div>
                <div className="vicram-table-wrap">
                  <table className="vicram-table">
                    <thead>
                      <tr>
                        <th>Grid</th>
                        <th>VCS</th>
                        <th>Words</th>
                        <th>Images</th>
                        <th>TLC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCells.map((cell) => (
                        <tr key={`${cell.row}-${cell.column}`}>
                          <td>
                            {cell.row}-{cell.column}
                          </td>
                          <td>{Number(cell.vcs).toFixed(4)}</td>
                          <td>{Number(cell.word_count).toFixed(2)}</td>
                          <td>{Number(cell.images).toFixed(2)}</td>
                          <td>{cell.tlc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="vicram-panel">
                <div className="vicram-section-title">
                  <h2>Summary Report</h2>
                  <span>{result.debug?.text_rects ?? 0} text rects</span>
                </div>
                <pre className="vicram-summary">{result.summary_report}</pre>
              </article>
            </section>
          </section>
        ) : null}
      </main>
    </>
  );
}
