# Local Gaze Focus Tracker

This project tracks webcam gaze in real time and overlays:
- current focus point (moving dot)
- gaze heatmap (where you looked)
- coverage map (which regions were visited)

It includes a single-page browser UI where you can input any target URL and load that site through a local proxy.
The tracker is powered by GazeCloudAPI.

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

5. Before using the tracker, register the page origin you open in the browser:

```text
https://api.gazerecorder.com/register/
```

For example, if you open `http://localhost:5500`, register that origin first.

6. In the page:
- Enter target URL (for example `https://example.com`)
- Click `Load URL`
- Click `Start Tracking`
- Allow camera permission
- Complete calibration in the GazeCloudAPI camera overlay

## Notes

- `localhost` is treated as a secure context for camera access in most browsers.
- GazeCloudAPI needs network access and a registered origin to start successfully.
- Proxy mode improves iframe compatibility for many sites, but very dynamic/login-heavy pages can still behave differently.
- Better lighting and keeping your face centered improve gaze accuracy.
- GazeCloudAPI docs: https://gazerecorder.com/gazecloudapi/
