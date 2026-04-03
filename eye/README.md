# Local Gaze Focus Tracker

This project tracks webcam gaze in real time and overlays:
- current focus point (moving dot)
- gaze heatmap (where you looked)
- coverage map (which regions were visited)

It includes a single-page browser UI where you can input any target URL and load that site through a local proxy.

## Run

1. Open this folder in VSCode.
2. Open terminal in this folder.
3. Start the local proxy server:

```powershell
python proxy_server.py --port 5500
```

4. Open:

```text
http://localhost:5500
```

5. In the page:
- Enter target URL (for example `https://example.com`)
- Click `Load URL`
- Click `Start Tracking`
- Allow camera permission
- Complete calibration (click each red point 5 times while looking at it)

## Notes

- `localhost` is treated as a secure context for camera access in most browsers.
- Proxy mode improves iframe compatibility for many sites, but very dynamic/login-heavy pages can still behave differently.
- Better lighting and keeping your face centered improve gaze accuracy.
- WebGazer source: https://webgazer.cs.brown.edu/webgazer.js
