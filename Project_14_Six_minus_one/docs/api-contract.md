# API Contract

This document defines the current backend contract for the cognitive accessibility dashboard.

## 1. Analyze HTML

`POST /analyze`

Request body:

```json
{
  "html": "<html>...</html>",
  "source_name": "simple-page.html",
  "baseline_run_id": "optional-history-run-id"
}
```

Notes:

- `html` is still the unified analyzer input.
- `source_name` is optional. When omitted, the backend stores `"Manual HTML"`.
- `baseline_run_id` is optional. When present and valid, the backend records that the new run was compared against a previous history run.

## 2. Analyze ZIP

`POST /analyze-zip`

Request type:

- `multipart/form-data`

Fields:

- `file`: required `.zip` file
- `baseline_run_id`: optional history run id

Backend behavior:

1. Read the ZIP file.
2. Prefer `index.html` or `index.htm`.
3. Otherwise use the first `.html` / `.htm` file found in the archive.
4. Reuse the normal analysis pipeline.
5. Persist the new analysis run to history.

## 3. Analysis Response Shape

Both `POST /analyze` and `POST /analyze-zip` return the analysis result plus persisted run metadata:

```json
{
  "overall_score": 74,
  "weighted_average": 79,
  "min_dimension_score": 68,
  "dimensions": [
    {
      "dimension": "Readability",
      "score": 82,
      "issues": [],
      "metadata": {}
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

## 4. Visual Complexity Score

`POST /visual-complexity`

Request body:

```json
{
  "html": "<html>...</html>"
}
```

This endpoint estimates page visual complexity from static HTML. It follows the paper-inspired VCS model using:

```text
raw = 1.743 + 0.097*TLC + 0.053*words + 0.003*images
vcs_0_to_10 = min(10, raw / 10)
score = max(0, round(100 - vcs_0_to_10 * 10))
```

Response shape:

```json
{
  "model": "DOM-based Visual Complexity Score inspired by ViCRAM",
  "vcs_raw": 8.52,
  "vcs_0_to_10": 0.85,
  "score": 91,
  "complexity_level": "very low",
  "metrics": {
    "tlc_count": 24,
    "word_count": 83,
    "image_count": 1,
    "grid_rows": 10,
    "grid_cols": 10
  },
  "formula": {
    "raw": "1.743 + 0.097*TLC + 0.053*words + 0.003*images",
    "vcs_0_to_10": "min(10, raw / 10)",
    "score": "max(0, round(100 - vcs_0_to_10 * 10))"
  },
  "heatmap": [
    {
      "row": 0,
      "col": 0,
      "tlc_count": 1,
      "word_count": 8,
      "image_count": 0,
      "vcs_raw": 2.264,
      "relative_intensity": 0.54,
      "color": "yellow"
    }
  ],
  "notes": []
}
```

`POST /visual-complexity-url`

Request body:

```json
{
  "url": "https://example.com"
}
```

This endpoint captures a Playwright-rendered snapshot, then calculates visual complexity using real element bounding boxes. TLCs and images are assigned to the grid cell containing the element's top-left coordinate; words are distributed across the cells covered by their rendered text box.

Runtime requirement:

```text
python -m pip install -r requirements.txt
python -m playwright install chromium
```

If Playwright or Chromium is unavailable, the endpoint returns `503` with setup guidance.

## 5. History List

`GET /history?limit=8`

Response:

```json
{
  "items": [
    {
      "run_id": "8a9d7c...",
      "created_at": "2026-04-09T18:20:00+10:00",
      "source_name": "simple-page.html",
      "overall_score": 74,
      "weighted_average": 79,
      "min_dimension_score": 68
    }
  ]
}
```

Notes:

- Results are returned newest first.
- `limit` is clamped to `1..50`.

## 6. History Detail

`GET /history/{run_id}`

Response:

```json
{
  "run": {
    "run_id": "8a9d7c...",
    "created_at": "2026-04-09T18:20:00+10:00",
    "source_name": "simple-page.html",
    "overall_score": 74,
    "weighted_average": 79,
    "min_dimension_score": 68
  },
  "html_content": "<html>...</html>",
  "analysis": {
    "overall_score": 74,
    "weighted_average": 79,
    "min_dimension_score": 68,
    "dimensions": [
      {
        "dimension": "Readability",
        "score": 82,
        "issues": [],
        "metadata": {}
      }
    ]
  }
}
```

This endpoint is used by the frontend `History` card for:

- viewing an older run
- setting a history item as the comparison baseline
- restoring the original HTML into the preview/editor

## 7. Dimension Result Shape

Each analyzer returns:

```json
{
  "dimension": "Readability",
  "score": 82,
  "issues": [
    {
      "rule_id": "RD-1",
      "title": "Average sentence length is too long",
      "severity": "major",
      "base_penalty": 3,
      "penalty": 6,
      "description": "Average sentence length exceeds the threshold.",
      "suggestion": "Split long sentences into shorter statements.",
      "evidence": {
        "average_sentence_length": 24.1
      },
      "locations": []
    }
  ],
  "metadata": {}
}
```

## 8. Severity and Penalty

Allowed severity values:

- `minor`
- `major`
- `critical`

Penalty formula:

```text
Penalty = Base Penalty * Severity Multiplier
```

Severity multipliers:

- `minor = 1`
- `major = 2`
- `critical = 3`

## 9. Final Score

```text
Weighted Average
= Visual Complexity * 0.30
+ Readability * 0.25
+ Interaction & Distraction * 0.25
+ Consistency * 0.20

Final Score
= 0.5 * min_dimension_score
+ 0.5 * weighted_average
```

## 10. Module Responsibilities

- `analyzers/*.py`: detect issues for a single dimension
- `scoring.py`: calculate penalties and overall scores
- `history_store.py`: persist and read analysis history in SQLite
- `main.py`: expose API routes and orchestrate analysis + persistence
- `frontend/`: render dashboard, comparison, and history interactions
