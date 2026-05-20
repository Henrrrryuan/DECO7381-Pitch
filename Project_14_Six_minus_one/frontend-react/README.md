# CogniLens React Frontend

This folder contains the current CogniLens frontend. It replaces the older static HTML/JavaScript frontend with a Vite + React + React Router single-page app while still reusing some legacy dashboard logic during the migration.

## Role in the Project

The React frontend provides:

- Home page input flow for URL, HTML, and ZIP analysis.
- Loading page orchestration while analysis is running.
- Dashboard page for issue summaries, detector results, recommendations, and element highlighting.
- History page for saved runs, visual complexity evidence, Eye Evidence summaries, heatmaps, and downloads.
- Visual complexity page/flow support where enabled.

The app talks to the FastAPI backend on `127.0.0.1:8001`. In development, Vite runs on `127.0.0.1:5173` and proxies API requests to the backend.

## Main Files

```text
frontend-react/
  src/
    main.jsx                      React app entry point
    App.jsx                       route shell
    pages/
      HomePage.jsx
      LoadingPage.jsx
      DashboardPage.jsx
      HistoryPage.jsx
      VicramPage.jsx
    lib/
      common.js                   API origin/proxy helper
      heatmapDisplay.js           history heatmap rendering helpers
      eyeEvidenceSummary.js       Eye Evidence text helpers
      printAndDownload.js         download/print support
    dashboard/
      state/                      dashboard state and transitions
      rendering/                  issue and detector rendering
      highlights/                 element highlight engine/rules
      detectors/                  detector metadata and semantics
    legacy/
      dashboardApp.js             legacy dashboard logic retained during migration
  vite.config.js                  dev server and proxy setup
```

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The backend should also be running from the project root:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

## Scripts

```bash
npm run dev       # start Vite dev server on 127.0.0.1:5173
npm run build     # build production assets
npm run preview   # preview built app with the same proxy rules
npm run lint      # run ESLint
npm test          # run lightweight frontend unit tests
```

## Proxy Notes

`vite.config.js` proxies these paths to FastAPI:

- `/analyze`
- `/analyze-url`
- `/analyze-zip`
- `/assistant`
- `/health`
- `/api`
- `/samples`
- `/sample-input`
- `/preview`
- `/eye`
- `/history`

The `/history` path is both a React route and a backend API route. The Vite middleware distinguishes HTML navigations from API requests so that the History page can render without breaking backend history calls.

## Design Note

The current frontend is intentionally hybrid. React owns the page shell, routing, and workflow screens, while selected legacy dashboard modules still handle complex detector rendering and interaction logic. This reduced migration risk while making the product structure clearer for final demonstration and future refactoring.
