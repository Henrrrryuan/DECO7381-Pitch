# CogniLens: Cognitive Accessibility Assistant for Web Content

CogniLens is a working MVP for helping web content teams review cognitive accessibility risks in static or semi-static webpages. It combines automated DOM/content analysis, a React dashboard, local analysis history, optional visual complexity evidence, and an optional Eye Tracking evidence workflow.

The prototype is designed for developers and designers who need clear, explainable feedback about where a webpage may create cognitive load for users.

## Current MVP Features

- URL, single HTML, and ZIP website analysis.
- React frontend with Home, Loading, Dashboard, History, and Visual Complexity views.
- Ten core cognitive accessibility detectors:
  - Dense Text Detection
  - Language Complexity
  - Sentence Complexity
  - Long Content Without Chunking
  - Poor Heading Structure
  - Navigation Complexity
  - Weak Information Prominence
  - Visual Overload
  - Auto-Moving Content
  - Excessive Interruptions
- Dashboard issue cards with explanations, recommendations, and element highlighting where a stable target can be found.
- Multi-page ZIP preview support with dashboard updates for selected pages.
- Local SQLite-backed analysis history.
- History page support for visual complexity summaries, Eye Evidence summaries, heatmaps, and downloadable report views.
- Optional Eye Tracking workflow using GazeCloudAPI to collect gaze coordinates and convert them into element-level Eye Evidence.

## Directory Structure

```text
Project_14_Six_minus_one/
  README.md
  EYE_TRACKING_README.md
  THIRD_PARTY_SOURCES.md
  requirements.txt

  backend/
    main.py                         compatibility import for backend.app.main
    app/
      main.py                       FastAPI app, routers, static mounts
      core.py                       shared paths and app constants
      routers/
        analysis.py                 HTML, URL, ZIP analysis endpoints
        assistant.py                AI-assistant style follow-up endpoint
        eye.py                      eye session and temporary HTML endpoints
        history.py                  analysis history endpoints
        system.py                   health/sample/API endpoints
        vicram.py                   visual complexity endpoints
    services/
      analysis_service.py
      assistant_service.py
      eye_evidence_service.py       Eye Evidence scoring and interpretation
    adapters/
      http/eye_proxy.py
      input/
        snapshot_input.py
        url_input.py
        zip_input.py
      persistence/
        history_store.py            SQLite persistence layer
        eye_temp_html_store.py
    analyzers/
      analysis_selectors/           core detector implementations
    sample_input/                   team-created demo/test pages

  frontend-react/
    src/
      pages/                        React routes
      dashboard/                    dashboard state, rendering, highlighting
      legacy/dashboardApp.js        legacy dashboard logic kept during migration
      lib/                          shared frontend helpers
    public/logo-mascot.png
    vite.config.js
    package.json

  eye/
    index.html
    app.js
    styles.css
    README.md
    proxy_server.py                 standalone fallback/debug server
    GazeCloud-master/               third-party reference/example files

  docs/
    api-contract.md
    database-schema.dbml
    presentation-test-flow.md
```

## Documentation Map

- [Eye Tracking README](./EYE_TRACKING_README.md): GazeCloudAPI usage, Eye Evidence workflow, privacy limits, and verification.
- [Third-party Sources](./THIRD_PARTY_SOURCES.md): external APIs, open-source libraries, local database note, and AI-use disclosure pointers.
- [Frontend README](./frontend-react/README.md): React/Vite structure and development commands.
- [Eye module README](./eye/README.md): short run notes for the Eye Tracking page.
- [API Contract](./docs/api-contract.md): endpoint definitions and integration expectations.
- [Database Schema](./docs/database-schema.dbml): local persistence model.
- [Presentation Test Flow](./docs/presentation-test-flow.md): demo and testing checklist.
- [Visual Complexity README](./VICRAM_README.md): ViCRAM-inspired source attribution, scoring workflow, and prototype limitations.
- [Limitations](./LIMITATIONS.md): known prototype limitations.
- [Final Changelog](./FINAL_CHANGELOG.md): summary of larger product changes.

## Runtime Requirements

Backend:

- Python 3.11+ recommended
- dependencies in `requirements.txt`

Frontend:

- Node.js 20+ recommended
- dependencies in `frontend-react/package.json`

Eye Tracking:

- a modern browser with webcam support
- permission to access the camera
- network access to load GazeCloudAPI
- registered local origin if required by GazeCloudAPI

## Install

From `Project_14_Six_minus_one/`:

```bash
python -m pip install -r requirements.txt
```

Then install the React frontend dependencies:

```bash
cd frontend-react
npm install
```

## Run for Development

Start the FastAPI backend from `Project_14_Six_minus_one/`:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Start the React frontend:

```bash
cd frontend-react
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The Vite development server runs on port `5173` and proxies API requests, `/eye`, `/preview`, and `/sample-input` to the FastAPI backend on port `8001`.

The backend directly serves the Eye Tracking page at:

```text
http://127.0.0.1:8001/eye/
```

During normal development, the React navigation can also open the proxied Eye Tracking route from:

```text
http://127.0.0.1:5173/eye/
```

## Useful Commands

Backend tests:

```bash
python -m pytest backend/tests
```

Frontend test:

```bash
cd frontend-react
npm test
```

Frontend lint:

```bash
cd frontend-react
npm run lint
```

Frontend build:

```bash
cd frontend-react
npm run build
```

## Key Backend Routes

- `GET /health`
- `GET /api`
- `GET /samples/{sample_name}`
- `POST /analyze`
- `POST /analyze-url`
- `POST /analyze-zip`
- `GET /preview/{preview_id}/{asset_path}`
- `GET /history`
- `GET /history/{run_id}`
- `POST /history/{run_id}/visual-complexity`
- `POST /assistant/chat`
- `POST /vicram/analyze-url`
- `POST /api/vicram/analyze-url`
- `POST /api/vicram/analyze`
- `GET /eye/`
- `GET /eye/proxy?url=...`
- `POST /eye/temp-html`
- `GET /eye/temp-html/{token}`
- `GET /eye/sessions`
- `GET /eye/sessions/by-run/{run_id}`
- `GET /eye/sessions/{session_id}`
- `POST /eye/sessions`

## Data and Persistence

CogniLens does not depend on a third-party dataset. It analyzes user-provided or demo-provided webpages.

Analysis history is stored locally using SQLite through Python's `sqlite3` module. The default development database is created under:

```text
backend/analysis_history.sqlite3
```

This local database stores analysis runs, issue details, visual complexity summaries, and saved Eye Evidence sessions. It is not an external hosted database service.

## External Sources and AI Use

External libraries, APIs, and AI-assisted work must be disclosed for the final submission. Use:

- [THIRD_PARTY_SOURCES.md](./THIRD_PARTY_SOURCES.md) for external software/API/source attribution.
- [EYE_TRACKING_README.md](./EYE_TRACKING_README.md) for the GazeCloudAPI integration details.
- The team AI declaration cover sheet and AI prompt appendix for ChatGPT/Codex/Cursor usage.

Before final submission, confirm whether any images, icons, logos, or generated visual assets are team-created or externally sourced, then list them in the third-party sources appendix.
