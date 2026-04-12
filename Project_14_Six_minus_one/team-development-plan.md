# Early-Stage Collaboration Plan

This document is used to align the team’s development approach and avoid the situation where “everyone writes code, but nothing integrates cleanly at the end.”

The current project is divided into four dimensions:

1. Readability
2. Visual Complexity
3. Interaction & Distraction
4. Consistency

Each team member is responsible for one dimension, but everyone must develop under the same technical agreement.

---

## 1. Core Development Principles

Before anyone starts implementing their own module, the team must first align on the following:

1. Input format
2. Output data structure
3. Directory structure
4. Scoring method
5. Unified backend entry point
6. Frontend-backend API contract

The reason is simple:

- If everyone uses different input formats, the modules cannot be swapped or integrated
- If everyone returns different output fields, the frontend cannot render them consistently
- If everyone calculates the final score differently, the scores will conflict
- If there is no unified directory structure, merging will create many conflicts

So the correct order for this project should be:

1. Align the contract first
2. Develop in parallel second
3. Integrate everything at the end

---

## 2. Recommended Project Structure

The following structure is recommended:

```text
project/
├── backend/
│   ├── analyzers/
│   │   ├── readability.py
│   │   ├── visual.py
│   │   ├── interaction.py
│   │   └── consistency.py
│   ├── schemas.py
│   ├── scoring.py
│   ├── main.py
│   └── sample_input/
├── frontend/
│   ├── src/
│   └── ...
├── docs/
│   ├── api-contract.md
│   └── ...
└── README.md
```

---

## 3. Responsibility of Each Part

### 3.1 `backend/analyzers/`

This folder stores the analysis modules for the four dimensions.

Each person only needs to own one file, for example:

- The Readability owner works in `readability.py`
- The Visual owner works in `visual.py`
- The Interaction owner works in `interaction.py`
- The Consistency owner works in `consistency.py`

The responsibilities of these files are:

- Receive the unified input
- Detect rules for the assigned dimension
- Return results in the unified format

What they **must not** do:

- They must not decide how the final overall score is calculated
- They must not invent field names that differ from the rest of the team
- They must not add frontend dependencies on their own

### 3.2 `backend/schemas.py`

This file stores the unified data structure definitions.

Its role is to:

- Define which fields every analyzer must return
- Define what each issue object looks like
- Define what the final overall result looks like

It functions as the team’s “data contract.”

Without this file, it is easy to end up with situations like:

- Person A returns `severity`
- Person B returns `level`
- Person C returns `risk`

and then the frontend cannot consume the results.

### 3.3 `backend/scoring.py`

This file is dedicated to score calculation.

Its responsibilities are:

- Unify severity multipliers
- Unify the penalty algorithm
- Unify the overall score formula

Recommended contents include:

- `Penalty = Base * Severity`
- `Final = 0.5 * min_dimension_score + 0.5 * weighted_average`

That way, the four analyzers are responsible only for “finding issues,” not for “deciding the final score.”

### 3.4 `backend/main.py`

This is the unified backend entry point.

Its responsibilities are:

1. Receive HTML or file content from the frontend
2. Call the four analyzers in sequence
3. Aggregate the four dimension results
4. Call `scoring.py` to calculate the final score
5. Return the unified result to the frontend

The frontend should only call one endpoint in the future, for example:

- `POST /analyze`

The frontend should not call the four dimensions separately.

### 3.5 `backend/sample_input/`

This folder stores example HTML files for testing.

Its role is to:

- Let everyone debug against the same inputs
- Make it easier to perform a unified test before merging

At a minimum, it is recommended to include:

- `simple-page.html`
- `dense-page.html`

### 3.6 `frontend/`

The frontend should do only one thing:

- Consume the unified backend response
- Render the dashboard

The frontend should not recalculate scores on its own.

The frontend should focus on displaying:

1. Four dimension scores
2. The overall score
3. The issue list
4. Severity levels
5. Suggested fixes
6. Before / after reupload comparison

### 3.7 `docs/api-contract.md`

This file is the team-facing interface document.

Its responsibilities are:

- Tell everyone what the input should look like
- Tell the frontend what the output should look like
- Tell the backend that field names should not be changed casually

This file is very important because it acts as the team’s “contract manual.”

---

## 4. Unified Input Format

At the MVP stage, the recommended unified input is:

```python
html: str
```

Reasons:

- It is the simplest option
- It is the most stable option
- Everyone can handle it
- It is convenient for later file-based loading

It is not recommended in the first version for different people to consume:

- File paths
- URLs
- DOM objects
- PDFs
- Images

because that would make the four modules completely inconsistent.

---

## 5. Unified Function Interface

It is recommended that all four analyzers use the same function signature:

```python
def analyze_readability(html: str) -> dict:
    ...
```

The other three modules follow the same pattern:

```python
def analyze_visual(html: str) -> dict:
    ...

def analyze_interaction(html: str) -> dict:
    ...

def analyze_consistency(html: str) -> dict:
    ...
```

Benefits of this approach:

- `main.py` can call them easily
- Everyone follows a consistent implementation style
- Debugging is easier
- Tomorrow’s merge will be much safer

---

## 6. Unified Output Data Structure

### 6.1 Per-Dimension Return Format

Each analyzer must return:

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
      "description": "Average sentence length exceeds 20 words and increases reading burden.",
      "suggestion": "Split long sentences into shorter ones.",
      "evidence": {
        "average_sentence_length": 24.1
      }
    }
  ]
}
```

### 6.2 Field Definitions

#### `dimension`

Indicates which dimension the result belongs to.

Allowed values:

- `Readability`
- `Visual Complexity`
- `Interaction & Distraction`
- `Consistency`

#### `score`

The score for the current dimension, constrained to:

```text
0 - 100
```

#### `issues`

The list of issues detected for the current dimension.

If there are no issues, it must still return an empty array:

```json
"issues": []
```

### 6.3 Issue Field Definitions

#### `rule_id`

The rule identifier, for example:

- `RD-1`
- `VC-2`
- `ID-3`
- `CS-1`

#### `title`

The issue title shown directly in the dashboard.

For example:

- `Average sentence length is too long`
- `Too many elements on the first screen`
- `Autoplay media`

#### `severity`

The severity level, which must be one of:

- `minor`
- `major`
- `critical`

No other custom values should be introduced.

#### `base_penalty`

The base deduction for the rule, such as `3` or `4`.

#### `penalty`

The final deduction, calculated using the unified rule:

```text
Penalty = Base Penalty * Severity Multiplier
```

Recommended multipliers:

- `minor = 1`
- `major = 2`
- `critical = 3`

#### `description`

Explains why the issue matters.

This field is intended for users, not for the program itself.

#### `suggestion`

A specific fix recommendation.

For example:

- `Replace the button label with a more specific action`
- `Reduce the number of primary buttons and keep only one main CTA`

#### `evidence`

Stores supporting evidence detected by the rule.

For example:

```json
{
  "average_sentence_length": 24.1
}
```

or:

```json
{
  "cta_count": 4
}
```

This field helps with:

- Better explainability
- Easier debugging
- Later support for highlight positioning

---

## 7. Overall API Response Structure

`main.py` should ultimately return:

```json
{
  "overall_score": 74,
  "weighted_average": 79,
  "min_dimension_score": 68,
  "dimensions": [
    {
      "dimension": "Readability",
      "score": 82,
      "issues": []
    },
    {
      "dimension": "Visual Complexity",
      "score": 68,
      "issues": []
    },
    {
      "dimension": "Interaction & Distraction",
      "score": 77,
      "issues": []
    },
    {
      "dimension": "Consistency",
      "score": 71,
      "issues": []
    }
  ]
}
```

### Field Definitions

#### `overall_score`

The final overall score.

#### `weighted_average`

The weighted average across the four dimensions.

#### `min_dimension_score`

The lowest score among the four dimensions.

#### `dimensions`

The array containing the results of the four analyzers.

---

## 8. Unified Scoring Rules

### 8.1 Dimension Weights

Use the following unified weights:

| Dimension | Weight |
| --- | --- |
| Visual Complexity | 30% |
| Readability | 25% |
| Interaction & Distraction | 25% |
| Consistency | 20% |

### 8.2 Final Overall Score Formula

```text
Weighted Average
= Visual * 0.30
+ Readability * 0.25
+ Interaction * 0.25
+ Consistency * 0.20

Final Score
= 0.5 * min_dimension_score
+ 0.5 * weighted_average
```

### 8.3 Why This Must Be Centralised in `scoring.py`

If four different people calculate the overall score separately, it is easy to end up with:

- Different weights
- Different severity multipliers
- Mismatches between frontend display and backend results

Therefore:

- The analyzers only find issues
- `scoring.py` is solely responsible for score calculation

---

## 9. What Each Person Should Build

### 9.1 Readability Owner

Responsible for:

- `RD-1` Average sentence length > 20
- `RD-2` Paragraph > 4 sentences
- `RD-3` Vague button text

The output must follow the unified format.

### 9.2 Visual Owner

Responsible for:

- `VC-1` First-screen elements > 12
- `VC-2` Dense cards > 6 items
- `VC-3` Too many sidebars or banners

The output must follow the unified format.

### 9.3 Interaction Owner

Responsible for:

- `ID-1` Autoplay
- `ID-2` Animated elements > 2
- `ID-3` CTA count > 2

The output must follow the unified format.

### 9.4 Consistency Owner

Responsible for:

- `CS-1` Heading structure gap
- `CS-2` Missing breadcrumb / progress

The output must follow the unified format.

---

## 10. Recommended Development Order

### Complete Today First

1. Confirm the directory structure
2. Confirm `schemas.py`
3. Confirm analyzer input/output formats
4. Confirm the formula in `scoring.py`
5. Confirm the sample HTML files

### Local Development Tonight

Each person should implement only their own analyzer and avoid changing other people’s modules.

### Merge Order Tomorrow

1. Merge the shared files first
   - `schemas.py`
   - `scoring.py`
   - `main.py`
2. Integrate the four analyzers one by one
3. Connect the frontend to the unified API last

---

## 11. Git Collaboration Suggestions

Each person should use one branch:

- `feature/readability`
- `feature/visual`
- `feature/interaction`
- `feature/consistency`

Do not let four people edit the main branch at the same time.

Suggested workflow:

1. Create the shared main branch first
2. Each person writes code on their own branch
3. One person is responsible for integration tomorrow
4. Run unified testing after integration is finished

---

## 12. Minimum Collaboration Rules

These six rules must be unified:

1. Input must always be `html: str`
2. Output field names must match exactly
3. The `score` range must always be `0-100`
4. `severity` may only be `minor / major / critical`
5. The overall score may only be calculated through `main.py + scoring.py`
6. The frontend should consume one unified endpoint rather than four separate analyzer endpoints

---

## 13. One-Sentence Summary for the Team

We are not building four separate mini-projects. We are building four analysis modules under one shared contract.

So the most important thing is not who writes rules first. The most important thing is to align first on:

- Input
- Output
- Field names
- The scoring algorithm
- The overall API

As long as those five things are aligned, tomorrow’s merge will be much smoother. Otherwise, everyone may finish their own code and still end up with pieces that do not fit together.
