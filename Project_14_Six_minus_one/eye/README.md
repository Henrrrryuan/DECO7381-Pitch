# CogniLens Eye Tracking Tool

This folder contains the Eye Tracking validation tool used by CogniLens. It tracks webcam gaze in real time and overlays:

- current focus point
- gaze heatmap
- coverage map

In the unified project setup, this tool is served by the main FastAPI app under `/eye/`.

## Run Through CogniLens

From the `Project_14_Six_minus_one` folder, start the main FastAPI app:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/eye/
```

The target webpage iframe is loaded through:

```text
http://127.0.0.1:8001/eye/proxy?url=...
```

Before using GazeCloudAPI, register this origin if required:

```text
http://127.0.0.1:8001
```

## Standalone Fallback

This folder still includes `proxy_server.py` for standalone testing:

```powershell
python proxy_server.py --port 5600
```

Then open:

```text
http://127.0.0.1:5600
```

Use the unified FastAPI route for the main project demo unless standalone debugging is needed.

## Notes

- Local loopback origins such as `127.0.0.1` are typically treated as secure contexts for camera access in modern browsers.
- GazeCloudAPI needs network access and a registered origin to start successfully.
- Proxy mode improves iframe compatibility for many sites, but very dynamic or login-heavy pages can still behave differently.
- Better lighting and keeping your face centered improve gaze accuracy.
