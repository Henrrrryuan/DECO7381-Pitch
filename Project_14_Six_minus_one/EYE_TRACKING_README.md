# CogniLens Eye Tracking README

This document explains the Eye Tracking / Eye Evidence module in CogniLens for the final prototype codebase submission. It covers how to run the feature, which external API it uses, what data it depends on, and the privacy/ethical limits of the implementation.

## Purpose in CogniLens

The Eye Tracking module is an optional behavioural evidence layer for CogniLens. The main CogniLens analysis detects cognitive accessibility issues from webpage structure, content, interaction patterns, and visual complexity. Eye Tracking adds a second type of evidence by recording where a user appears to look during a short webpage review session.

In the current prototype, the Eye Tracking workflow is used to:

- load a target webpage by URL, HTML file, or ZIP website upload
- collect gaze coordinates through a browser-based eye-tracking API
- draw a heatmap and visited map
- connect gaze positions to webpage element groups such as headings, interactive elements, main text, navigation, and media
- save an eye session to an existing CogniLens analysis history record
- display Eye Evidence in the History page and Heatmap detail view

This feature is not intended to diagnose users or make medical claims. It is a prototype mechanism for showing how behavioural attention evidence could support cognitive accessibility review.

## Relevant Files

```text
Project_14_Six_minus_one/
  EYE_TRACKING_README.md          This document
  eye/
    index.html                    Eye Tracking page
    app.js                        gaze handling, heatmap, element hits, save session logic
    styles.css                    Eye Tracking page styles
    README.md                     short module-level running notes
    proxy_server.py               standalone fallback proxy for debugging
  backend/
    app/routers/eye.py            backend routes for eye sessions and temporary HTML
    app/routers/history.py        history routes that expose saved evidence
    adapters/persistence/history_store.py
                                    persistence layer for analysis and eye evidence
    services/eye_evidence_service.py
                                    scoring and interpretation for Eye Evidence
```

## External API and Third-Party Source

### GazeCloudAPI

CogniLens uses GazeCloudAPI for browser-based webcam gaze estimation.

- Provider/source: https://gazerecorder.com/gazecloudapi/
- API registration page: https://api.gazerecorder.com/register/
- Script used by the prototype: https://api.gazerecorder.com/GazeCloudAPI.js
- Integration file: `eye/index.html`
- Runtime API usage file: `eye/app.js`

The external API provides gaze callback data, including document-coordinate gaze positions and timestamps. CogniLens then adds its own processing layer on top of those coordinates: heatmap rendering, DOM element hit detection, weighted attention summaries, risk labels, and History/Heatmap display.

GazeCloud reference/example files were used as third-party integration reference material during development, but the final codebase runtime uses `eye/index.html`, `eye/app.js`, and the provider CDN script rather than bundling those reference examples.

## Runtime Requirements

The Eye Tracking feature requires:

- a modern browser with webcam support
- permission to access the webcam
- network access to load `https://api.gazerecorder.com/GazeCloudAPI.js`
- a local CogniLens backend running on `127.0.0.1`
- a valid CogniLens analysis `run_id` if the user wants to save the eye session into History

Local loopback origins such as `http://127.0.0.1:8001` are normally treated as secure contexts by modern browsers for camera access, but browser behaviour can vary.

If GazeCloudAPI requires origin registration, register:

```text
http://127.0.0.1:8001
```

or the equivalent local/deployed origin used for the prototype demo.

## How to Run Through the Unified CogniLens App

From the `Project_14_Six_minus_one` folder, install backend dependencies:

```bash
python -m pip install -r requirements.txt
```

Start the FastAPI backend:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open the Eye Tracking page:

```text
http://127.0.0.1:8001/eye/
```

For the full React frontend workflow, also start the React app:

```bash
cd frontend-react
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

Recommended workflow:

1. Run a webpage analysis in CogniLens.
2. Open Eye Tracking from the product navigation so the page carries the related `run_id`.
3. Load a URL, HTML file, or ZIP website.
4. Click `Start Tracking`.
5. Allow camera access and complete the GazeCloud calibration.
6. Review the page naturally.
7. Pause tracking and show the heatmap if needed.
8. Click `Save Session` to attach the Eye Evidence to the analysis history record.
9. Return to History and use `View Heatmap` to review the saved evidence.

Saving a session requires a valid history run id. The direct URL format is:

```text
http://127.0.0.1:8001/eye/?run_id=<analysis-run-id>
```

## Loading Target Pages

The Eye Tracking page supports three target-page input modes:

### URL input

The URL is loaded through the local proxy route:

```text
/eye/proxy?url=<encoded-target-url>
```

This improves iframe compatibility for many static pages, but some dynamic, login-heavy, or security-restricted sites may not render exactly as they do in a normal browser tab.

### HTML file upload

The user can upload a single `.html` or `.htm` file. The backend stores it temporarily and loads it through an internal temporary HTML route.

### ZIP website upload

The Eye Tracking page reuses the existing CogniLens ZIP analysis support. ZIP upload is useful when a static site has separate HTML, CSS, JavaScript, and image files. The backend chooses an HTML entry file and prepares a preview route where possible.

## Data Dependencies

The Eye Tracking module does not depend on a fixed research dataset. It depends on user-provided or demo-provided webpage input:

- a target URL
- an uploaded HTML file
- an uploaded ZIP website package
- an existing CogniLens analysis history `run_id` if the session should be saved

The module also depends on live gaze data returned by GazeCloudAPI during a tracking session.

## What Data Is Collected or Stored

During an Eye Tracking session, CogniLens processes gaze evidence such as:

- gaze coordinates
- timestamps
- sample count
- session duration
- heatmap cells
- coverage/visited-map data
- target page URL or source name
- element-level hit summaries
- risk labels and interpretation text

The saved evidence is linked to a CogniLens history record so it can be reviewed later from the History page.

The prototype does not intentionally store raw webcam video footage. However, because the eye tracker uses an external browser-based API, webcam access and gaze estimation should be treated as privacy-sensitive. Users should only run Eye Tracking with informed consent.

## Privacy and Ethical Considerations

Eye tracking can reveal behavioural attention patterns, so CogniLens treats this module as optional supporting evidence rather than a required analysis step.

Key privacy and ethics boundaries:

- Eye Tracking should be used only with informed consent.
- The feature should not be used to diagnose a user or infer medical conditions.
- Eye Evidence describes interaction with a webpage, not a user's ability or personal value.
- The prototype avoids intentionally saving webcam video.
- Saved gaze evidence should be handled as sensitive behavioural data.
- Low-confidence gaze evidence should not be overinterpreted.
- The main product should remain useful without Eye Tracking.

This design supports the project goal of helping developers understand webpage cognitive accessibility risks while avoiding unnecessary user surveillance.

## Limitations

The Eye Tracking module is a prototype and has important limitations:

- Webcam gaze estimation is approximate and can drift.
- Accuracy depends on lighting, camera quality, face position, screen distance, calibration quality, and browser support.
- Heatmaps can distract users during active tracking, so the prototype supports showing heatmaps after pause or through a manual visibility toggle.
- Dynamic websites may re-render DOM elements, which can make element highlighting or element hit interpretation less stable.
- Some external sites block iframe/proxy rendering through security headers or login requirements.
- Eye Evidence should be interpreted together with static accessibility analysis, not as a standalone judgement.

## Internal CogniLens Contribution Around the API

GazeCloudAPI provides gaze coordinates, but the CogniLens project adds the product-specific evidence workflow:

- maps gaze coordinates onto the tested iframe/page area
- uses DOM-based element detection to classify what type of content was looked at
- uses tolerant near-hit logic to reduce webcam gaze jitter effects
- calculates heatmap and visited-map summaries
- converts element attention into risk drivers such as headings, interactive elements, main text, and media
- separates risk from evidence confidence
- saves Eye Evidence into the CogniLens history workflow
- displays concise evidence in History and detailed evidence in the Heatmap modal

This means the external API is used as an input source, while the cognitive accessibility interpretation and product workflow are implemented in CogniLens.

## Quick Verification Checklist

Use this checklist before submitting the final codebase:

- Backend starts successfully on `127.0.0.1:8001`.
- Eye Tracking page opens at `/eye/`.
- GazeCloudAPI script loads without console errors.
- Browser asks for camera permission after `Start Tracking`.
- Calibration starts and can be completed.
- URL loading works for a simple public page such as `https://example.com`.
- HTML upload works for a simple local HTML file.
- ZIP upload works for a small static site package.
- Pause/Resume and Show/Hide Heatmap work.
- Save Session works when a valid `run_id` is present.
- History can reopen the saved heatmap and Eye Evidence detail.

## Related Submission Notes

For the final team project submission, this README should be included in the codebase zip together with the main `README.md`. External source attribution for GazeCloudAPI should also be included in the team report reference/source list. Any AI prompts used to design, debug, or implement this module should be included in the required AI prompts appendix.
