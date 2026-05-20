# CogniLens Eye Tracking Tool

This folder contains the Eye Tracking validation tool used by CogniLens. For the fuller submission-facing documentation, see [`../EYE_TRACKING_README.md`](../EYE_TRACKING_README.md).

The tool tracks webcam gaze in real time and can show:

- current focus point
- gaze heatmap
- coverage map
- element-level Eye Evidence summaries

In the current project setup, the React app normally runs on `127.0.0.1:5173` and the FastAPI backend runs on `127.0.0.1:8001`. The backend serves this tool under `/eye/`, and Vite proxies `/eye` during frontend development.

## Run Through CogniLens

From the `Project_14_Six_minus_one` folder, start the main FastAPI app:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/eye/
```

Or, with the React dev server running:

```text
http://127.0.0.1:5173/eye/
```

**Linking to an analysis:** Behavioral evidence is stored against a history `run_id`. After running an analysis on the dashboard, use the Eye Tracking navigation entry so the app carries the related `run_id`, or open:

```text
http://127.0.0.1:8001/eye/?run_id=<your-report-id>
```

Saving a session requires a valid `run_id` that exists in analysis history.

The target webpage iframe is loaded through:

```text
http://127.0.0.1:8001/eye/proxy?url=...
```

Before using GazeCloudAPI, register this origin if required:

```text
http://127.0.0.1:8001
```

## Target Page Input Modes

The current Eye Tracking page supports:

- URL loading through `/eye/proxy?url=...`
- single HTML upload
- ZIP website upload for static sites with separate CSS/JS/assets

## Standalone Fallback

This folder still includes `proxy_server.py` for standalone testing:

```powershell
python proxy_server.py --port 5600
```

Then open:

```text
http://127.0.0.1:5600
```

Use the FastAPI/Vite route for the main project demo unless standalone debugging is needed.

## Notes

- Local loopback origins such as `127.0.0.1` are typically treated as secure contexts for camera access in modern browsers.
- GazeCloudAPI needs network access and a registered origin to start successfully.
- Proxy mode improves iframe compatibility for many sites, but very dynamic or login-heavy pages can still behave differently.
- Better lighting and keeping your face centered improve gaze accuracy.
