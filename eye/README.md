# Local Gaze Focus Tracker

This project uses your webcam to estimate gaze position in real time and draw:
- current focus point (moving dot)
- gaze heatmap (where you have looked)
- coverage map (which screen regions have been visited)

## Run in VSCode

1. Open folder `D:\eye` in VSCode.
2. Open VSCode terminal.
3. Start a local server:

```powershell
python -m http.server 5500
```

4. Open browser at:

```text
http://localhost:5500
```

5. Click `Start Tracking`, allow camera permission, then finish calibration (click each red point 5 times while looking at it).

## Notes

- Camera access usually needs a secure context; `localhost` works.
- Better lighting and staying roughly centered in front of camera will improve accuracy.
- This app uses WebGazer from:
  - https://webgazer.cs.brown.edu/webgazer.js
