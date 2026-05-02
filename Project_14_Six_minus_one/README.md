# CogniLens: Cognitive Accessibility Assistant

CogniLens is a working MVP for reviewing webpages through a cognitive accessibility lens. It accepts HTML or ZIP website uploads, analyzes four dimensions, stores previous reports, supports version comparison, and includes an optional eye-tracking validation tool.

## Current MVP Features

- HTML and ZIP upload for webpage analysis
- Four analysis dimensions: Information Overload, Readability, Interaction & Distraction, and Consistency
- Overall score, dimension scores, issue explanations, and recommendations
- Dashboard comparison between current and previous submissions
- History storage with reopen support
- AI-assisted follow-up guidance
- Eye Tracking as a separate validation layer under the same FastAPI app
- Additional Visual Complexity analysis endpoints for HTML and rendered URL snapshots

## Directory Structure

```text
backend/
  adapters/
    http/
      eye_proxy.py
    input/
      snapshot_input.py
      url_input.py
      zip_input.py
    persistence/
      history_store.py
  analyzers/
    information_overload.py
    readability.py
    interaction.py
    consistency.py
    visual_complexity.py
  app/
    main.py
    core.py
    routers/
      analysis.py
      assistant.py
      eye.py
      history.py
      system.py
  main.py
  services/
    analysis_service.py
    assistant_service.py
  schemas.py
  scoring.py
  sample_input/
frontend/
  index.html
  dashboard.html
  history.html
  docs.html
  common.js
eye/
  index.html
  app.js
  styles.css
  proxy_server.py
docs/
  api-contract.md
```

## Documentation

Use the docs below for deeper reference while keeping this README focused on setup and day-to-day usage:

- [API Contract](./docs/api-contract.md): endpoint definitions, request/response shapes, and integration expectations.
- [Database Schema (DBML)](./docs/database-schema.dbml): MVP data model for runs, dimension results, issues, and compare pairs.
- [Presentation Test Flow](./docs/presentation-test-flow.md): demo/test checklist and step-by-step presentation script.

## Backend Refactor Summary (Apr 2026)

The backend was restructured to make ownership and interview storytelling clearer while keeping API behavior unchanged.

### What changed

- Introduced a layered backend structure:
  - `backend/app/routers`: FastAPI route handlers grouped by domain
  - `backend/services`: analysis and assistant orchestration logic
  - `backend/adapters`: external IO and persistence adapters
  - `backend/analyzers`: dimension algorithms only
- Renamed the former `visual` dimension implementation to `information_overload.py`.
- Consolidated duplicate analyzer wrappers:
  - merged `visual_complexity_score.py` into `visual_complexity.py`
  - removed obsolete compatibility wrapper files
- Removed unused/empty backend files and dead code segments.

### Why this refactor

- Reduce large-file coupling and make module boundaries explicit.
- Align file names with actual domain language (especially Information Overload).
- Make future frontend migration (to React) easier by stabilizing backend contracts.
- Improve maintainability and code interview readability without changing endpoint contracts.

## Runtime Dependencies

Install the backend dependencies before starting the app:

```bash
python -m pip install -r requirements.txt
```

## Run As A Unified App

Start only the FastAPI app from this folder:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/index.html
http://127.0.0.1:8001/eye/
```

The main frontend, backend API, and Eye Tracking tool are all served from the same port.

## Key Routes

- `GET /health`
- `POST /analyze`
- `POST /analyze-zip`
- `GET /history`
- `GET /history/{run_id}`
- `GET /eye/`
- `GET /eye/proxy?url=...`

## Development Conventions

- All analyzers use a unified input format: `html: str`
- All analyzers return a unified output type: `DimensionResult`
- The overall score is calculated through `backend/scoring.py`
- Frontend API calls use same-origin relative paths
- Eye Tracking is an optional validation layer, not part of the core scoring pipeline
