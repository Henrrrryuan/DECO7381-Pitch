# API Contract

This document reflects the current FastAPI contract used by the React frontend (`frontend-react`) and the Eye Tracking UI.

CogniLens is a cognitive accessibility risk-signal detector. API responses describe rule-based DOM/static heuristics and supporting evidence. They are not a full WCAG/COGA compliance assessment and should not be treated as proof that a page is accessible.

## 1. Service Health and Discovery

- `GET /health` -> `{"status":"ok"}`
- `GET /api` -> service metadata and endpoint list
- `GET /samples/{sample_name}` -> named sample HTML where available
- `GET /sample-input/{path}` -> static sample input files for local demos

## 2. Analyze HTML

`POST /analyze`

Request body:

```json
{
  "html": "<html>...</html>",
  "source_name": "demo-page.html",
  "baseline_run_id": "optional-history-run-id",
  "persist_result": true
}
```

Notes:

- `source_name` is optional and defaults to a manual/source label when persisted.
- `baseline_run_id` is optional.
- `persist_result` defaults to `true`.
- If `persist_result=false`, the response omits the saved `run` object and does not write to History.

## 3. Analyze URL

`POST /analyze-url`

Request body:

```json
{
  "url": "http://127.0.0.1:5173/sample-page",
  "source_name": "optional-label",
  "baseline_run_id": "optional-history-run-id"
}
```

Notes:

- The backend fetches/proxies the target page and analyzes the resulting HTML bundle.
- Static or semi-static local/demo pages are the most reliable targets.
- Dynamic, login-heavy, bot-protected, or script-dependent sites may not match a normal browser session.
- The response includes `resource_bundle` metadata such as entry name, linked CSS/JS counts, and whether a rendered snapshot was used.

## 4. Analyze ZIP

`POST /analyze-zip` (`multipart/form-data`)

Fields:

- `file` (required, `.zip`)
- `baseline_run_id` (optional)

Validation:

- Non-ZIP uploads -> `400`
- Empty ZIP -> `400`
- Compressed ZIP upload limit -> `100MB`, returned as `413`
- ZIPs must contain at least one `.html` or `.htm` file

Preview behaviour:

- The backend extracts safe ZIP members into a local preview directory.
- It prefers `index.html` / `index.htm` at the root, then nested folder indexes, then the first HTML file.
- Relative CSS/JS/assets are resolved where possible.
- The analysis HTML is aligned with the selected preview entry where possible, so dashboard highlight targets match the iframe preview more closely.

## 5. Analysis Response Shape

`POST /analyze`, `POST /analyze-url`, and `POST /analyze-zip` return a saved analysis payload shaped like:

```json
{
  "overall_score": 76,
  "weighted_average": 82,
  "min_dimension_score": 70,
  "dimensions": [
    {
      "dimension": "Sentence Complexity",
      "display_name": "Sentence Complexity",
      "label": "Sentence Complexity",
      "issue_category_key": "content",
      "issue_category_label": "Content Issues",
      "cognitive_dimension": "Comprehension Burden",
      "score": 70,
      "issues": [
        {
          "rule_id": "SC-1",
          "title": "Sentence Complexity",
          "description": "Long or clause-heavy sentences can increase comprehension burden.",
          "suggestion": "Break long sentences into shorter steps or separate ideas.",
          "locations": [
            {
              "tag": "p",
              "selector": "main > p:nth-of-type(2)",
              "label": "Paragraph",
              "sentence_word_count": 34,
              "comma_count": 2,
              "conjunction_count": 4
            }
          ],
          "interpretation": {
            "confidence": "high",
            "heuristicBasis": "Sentence length, commas, and conjunction density."
          }
        }
      ],
      "metadata": {
        "detector": "Sentence Complexity",
        "implemented_rules": ["SC-1"],
        "total_penalty": 15
      }
    }
  ],
  "profile_scores": [],
  "run": {
    "run_id": "8a9d7c...",
    "created_at": "2026-05-21T13:00:00+10:00",
    "source_name": "demo-page.html",
    "overall_score": 76,
    "weighted_average": 82,
    "min_dimension_score": 70
  },
  "html_content": "<html>...</html>",
  "baseline_run_id": null
}
```

The current detector set contains these ten rule-based cognitive accessibility risk signals:

| Rule ID | Detector |
| --- | --- |
| `DT-1` | Dense Text Detection |
| `LC-1` | Language Complexity |
| `SC-1` | Sentence Complexity |
| `LCC-1` | Long Content Without Chunking |
| `PHS-1` | Poor Heading Structure |
| `NC-1` | Navigation Complexity |
| `WIP-1` | Weak Information Prominence |
| `VO-1` | Visual Overload |
| `AMC-1` | Auto-Moving Content |
| `EI-1` | Excessive Interruptions |

`/analyze-url` and `/analyze-zip` additionally return:

```json
{
  "resource_bundle": {
    "entry_name": "index.html",
    "css_file_count": 2,
    "js_file_count": 1,
    "css_files": ["styles/main.css"],
    "js_files": ["scripts/app.js"],
    "rendered_snapshot_used": false
  },
  "preview_url": "/preview/<preview-id>/index.html"
}
```

## 6. Visual Complexity Endpoints

- `POST /api/vicram/analyze` with `{ "html": "<html>...</html>", "url": "optional-label" }`
- `POST /api/vicram/analyze-url` with `{ "url": "http://127.0.0.1:5173/..." }`
- `POST /vicram/analyze-url` is also exposed for compatibility with the current frontend integration.

The Visual Complexity flow produces a page-level score, a screenshot-backed complexity map, map-cell summaries, and explanatory report data. It is supporting evidence for visual density review, not AI vision or a rendered visual-salience analysis.

If Playwright/Chromium is unavailable for URL rendering, visual-complexity URL analysis may return a service error and the main DOM/static analysis can still be reviewed.

## 7. History Endpoints

### 7.1 List

`GET /history?limit=25&offset=0&query=...`

- `limit` range: `1..100`
- Returns newest-first

Response:

```json
{
  "items": [
    {
      "run_id": "...",
      "created_at": "...",
      "source_name": "demo-page.html",
      "overall_score": 76,
      "weighted_average": 82,
      "min_dimension_score": 70,
      "visual_complexity_summary": {
        "available": true,
        "score": 5.4
      },
      "eye_tracking_summary": {
        "available": false
      }
    }
  ],
  "total": 1,
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
    "overall_score": 76,
    "weighted_average": 82,
    "min_dimension_score": 70,
    "dimensions": [],
    "profile_scores": []
  }
}
```

Not found -> `404` with `{"detail":"History run not found."}`.

### 7.3 Save Visual Complexity Evidence

`POST /history/{run_id}/visual-complexity`

Stores visual complexity evidence against an existing analysis run so History and Print can reopen the complexity map.

## 8. Eye Tracking Endpoints

- `GET /eye/` -> Eye Tracking page
- `GET /eye/proxy?url=...` -> proxied target-page response
- `POST /eye/temp-html` -> temporary HTML upload for Eye Tracking target preview
- `GET /eye/temp-html/{token}` -> temporary HTML preview
- `GET /eye/sessions?limit=25&offset=0&query=...&run_id=...`
- `GET /eye/sessions/by-run/{run_id}` -> latest linked session detail or `404`
- `GET /eye/sessions/{session_id}`
- `POST /eye/sessions`

`POST /eye/sessions` request body:

```json
{
  "run_id": "required-analysis-run-id-matching-history",
  "source_name": "optional-page-name",
  "target_url": "https://example.com",
  "html_snapshot": "<html>...</html>",
  "sample_count": 120,
  "duration_ms": 45000,
  "coverage_percent": 62.5,
  "grid_cols": 24,
  "grid_rows": 14,
  "cell_counts": [0, 3, 1],
  "summary": {}
}
```

Validation:

- Missing or blank `run_id` -> `400`
- Unknown `run_id` -> `400`
- Negative metrics -> `400`
- Invalid grid size -> `400`
- `len(cell_counts) != grid_cols * grid_rows` -> `400`

Eye Tracking evidence is optional supporting evidence. It is not proof of accessibility, a clinical cognitive-load measurement, or a replacement for user testing.

## 9. Assistant Endpoint

`POST /assistant/chat`

Request body:

```json
{
  "message": "What should I review first?",
  "source_name": "demo-page.html",
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

The assistant endpoint is optional support around the saved analysis context. It is not part of detector scoring.

## 10. Scoring Notes

Issue penalties are fixed per detector when a rule-based issue is raised. The score is an MVP prioritisation aid for the dashboard, not a compliance score.

```text
dimension_score = max(0, round(100 * (1 - sum(issue.penalty) / dimension_penalty_cap)))
weighted_average = sum(dimension.score * weight)
overall = 0.4 * min_dimension_score + 0.6 * weighted_average
```

Issue payloads expose `interpretation` metadata such as `confidence` and `heuristicBasis` so the frontend can explain that findings are static heuristics.
