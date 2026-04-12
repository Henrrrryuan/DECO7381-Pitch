# Cognitive Accessibility Assistant

This repository contains the shared development scaffold for the project.

Currently completed:

- Unified directory structure
- Unified data structures
- Unified scoring logic
- Common stubs for the four analyzers
- Unified backend entry point
- API contract documentation

Currently unfinished:

- Concrete rule implementations for the four dimensions
- Frontend dashboard
- File upload and reupload comparison interface

## Directory Structure

```text
backend/
  analyzers/
  schemas.py
  scoring.py
  main.py
  sample_input/
docs/
  api-contract.md
frontend/
```

## Runtime Dependencies

Before starting the backend, install the required dependencies:

```bash
python -m pip install -r requirements.txt
```

## Suggested Task Allocation

- Readability: implement in `backend/analyzers/readability.py`
- Visual Complexity: implement in `backend/analyzers/visual.py`
- Interaction & Distraction: implement in `backend/analyzers/interaction.py`
- Consistency: implement in `backend/analyzers/consistency.py`

## Development Conventions

- All analyzers use a unified input format: `html: str`
- All analyzers return a unified output type: `DimensionResult`
- The overall score is calculated only through `backend/scoring.py`
- The frontend consumes only the unified output returned by `main.py`
