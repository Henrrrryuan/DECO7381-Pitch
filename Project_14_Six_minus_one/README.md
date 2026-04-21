# CogniLens: Cognitive Accessibility Assistant

CogniLens is a working MVP for reviewing webpages through a cognitive accessibility lens. It accepts HTML or ZIP website uploads, analyzes four dimensions, stores previous reports, supports version comparison, and includes an optional eye-tracking validation tool.

## Current MVP Features

- HTML and ZIP upload for webpage analysis
- Four analysis dimensions: Visual Complexity, Readability, Interaction & Distraction, and Consistency
- Overall score, dimension scores, issue explanations, and recommendations
- Dashboard comparison between current and previous submissions
- History storage with reopen support
- AI-assisted follow-up guidance
- Eye Tracking as a separate validation layer under the same FastAPI app

## Directory Structure

```text
backend/
  analyzers/
  eye_proxy.py
  history_store.py
  main.py
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
