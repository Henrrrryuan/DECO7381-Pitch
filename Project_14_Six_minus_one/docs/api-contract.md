# API Contract

This document reflects the current FastAPI contract used by the React frontend (`frontend-react`) and the eye-tracking UI.

## 1. Service Health and Discovery

- `GET /health` -> `{"status":"ok"}`
- `GET /api` -> service metadata and endpoint list
- `GET /samples/{sample_name}` -> returns named sample HTML (`simple`, `dense`, `consistency`)

## 2. Analyze HTML

`POST /analyze`

Request body:

```json
{
  "html": "<html>...</html>",
  "source_name": "simple-page.html",
  "baseline_run_id": "optional-history-run-id",
  "persist_result": true
}
```

Notes:

- `source_name` is optional (defaults to `"Manual HTML"` when persisted).
- `baseline_run_id` is optional.
- `persist_result` defaults to `true`.
- If `persist_result=false`, the response omits `run` and does not write history.

## 3. Analyze URL

`POST /analyze-url`

Request body:

```json
{
  "url": "https://example.com",
  "source_name": "optional-label",
  "baseline_run_id": "optional-history-run-id"
}
```

Notes:

- Backend fetches URL via proxy, validates HTML content type, and analyzes inlined bundle content.
- Response includes `resource_bundle` metadata (`entry_name`, CSS/JS file counts, file lists).

## 4. Analyze ZIP

`POST /analyze-zip` (`multipart/form-data`)

Fields:

- `file` (required, `.zip`)
- `baseline_run_id` (optional)

Validation:

- Non-zip uploads -> `400`
- Empty zip -> `400`
- File size limit is `20MB` -> `413`

## 5. Analysis Response Shape

`POST /analyze`, `POST /analyze-url`, and `POST /analyze-zip` return:

```json
{
  "overall_score": 74,
  "weighted_average": 79,
  "min_dimension_score": 68,
  "dimensions": [
    {
      "dimension": "Readability",
      "display_name": "Readability Issues",
      "label": "Readability Issues",
      "issue_category_key": "RD",
      "issue_category_label": "Readability Issues",
      "cognitive_dimension": "Reading Load / Comprehension",
      "score": 82,
      "issues": [],
      "metadata": {}
    }
  ],
  "profile_scores": [
    {
      "name": "Reading Difficulties Lens",
      "score": 80,
      "summary": "..."
    }
  ],
  "run": {
    "run_id": "8a9d7c...",
    "created_at": "2026-04-09T18:20:00+10:00",
    "source_name": "simple-page.html",
    "overall_score": 74,
    "weighted_average": 79,
    "min_dimension_score": 68
  },
  "html_content": "<html>...</html>",
  "baseline_run_id": "optional-history-run-id"
}
```

`/analyze-url` and `/analyze-zip` additionally return:

```json
{
  "resource_bundle": {
    "entry_name": "https://example.com",
    "css_file_count": 2,
    "js_file_count": 3,
    "css_files": ["a.css"],
    "js_files": ["a.js"]
  }
}
```

## 6. Visual Complexity Endpoints

- `POST /visual-complexity` with `{ "html": "<html>...</html>" }`
- `POST /visual-complexity-url` with `{ "url": "https://example.com" }`

If Playwright/Chromium is unavailable for `/visual-complexity-url`, backend returns `503`.

## 7. History Endpoints

### 7.1 List

`GET /history?limit=25&offset=0&query=...`

- `limit` range: `1..100`
- Returns newest-first

Response:

```json
{
  "items": [],
  "total": 0,
  "limit": 25,
  "offset": 0
}
```

### 7.2 Detail

`GET /history/{run_id}`

Response:

```json
{
  "run": {},
  "html_content": "<html>...</html>",
  "analysis": {
    "overall_score": 74,
    "weighted_average": 79,
    "min_dimension_score": 68,
    "dimensions": [],
    "profile_scores": []
  }
}
```

Not found -> `404` with `{"detail":"History run not found."}`.

## 8. Eye Tracking Endpoints

- `GET /eye/proxy?url=...` -> proxied page response with `X-Proxy-Final-Url`
- `GET /eye/sessions?limit=25&offset=0&query=...&run_id=...`
- `GET /eye/sessions/{session_id}`
- `POST /eye/sessions`

`POST /eye/sessions` request body:

```json
{
  "run_id": "optional-history-run-id",
  "source_name": "optional-page-name",
  "target_url": "https://example.com",
  "html_snapshot": "<html>...</html>",
  "sample_count": 120,
  "duration_ms": 45000,
  "coverage_percent": 62.5,
  "grid_cols": 12,
  "grid_rows": 8,
  "cell_counts": [0, 3, 1],
  "summary": {}
}
```

Validation:

- Unknown `run_id` -> `400`
- Negative metrics -> `400`
- Invalid grid size -> `400`
- `len(cell_counts) != grid_cols * grid_rows` -> `400`

## 9. Assistant Endpoint

`POST /assistant/chat`

Request body:

```json
{
  "message": "How can I improve readability?",
  "source_name": "simple-page.html",
  "analysis_context": {}
}
```

Response:

```json
{
  "reply": "...",
  "provider": "claude | openai | fallback | scope-guard"
}
```

## 10. Scoring Rules (Current)

Severity multipliers:

- `minor = 1`
- `major = 2`
- `critical = 3`

Weighted average:

```text
Information Overload (or Visual Complexity alias) * 0.30
Readability * 0.25
Interaction & Distraction * 0.25
Consistency * 0.20
```

Overall score:

```text
overall = 0.4 * min_dimension_score + 0.6 * weighted_average
```
