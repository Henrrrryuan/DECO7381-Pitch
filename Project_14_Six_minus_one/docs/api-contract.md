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

## 4. History List

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

## 5. History Detail

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

## 6. Dimension Result Shape

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

## 7. Severity and Penalty

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

## 8. Final Score

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

## 9. Module Responsibilities

- `analyzers/*.py`: detect issues for a single dimension
- `scoring.py`: calculate penalties and overall scores
- `history_store.py`: persist and read analysis history in SQLite
- `main.py`: expose API routes and orchestrate analysis + persistence
- `frontend/`: render dashboard, comparison, and history interactions
