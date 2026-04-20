# Presentation Test Flow

This document is a practical demo and presentation test script for:

- CogniLens main project
- Local Gaze Focus Tracker (`eye` project)

It focuses on what to test, how to test it, and what result to show on screen.

## 1. Test Goal

The presentation should prove three things:

1. CogniLens can accept a web page file and generate cognitive accessibility analysis results.
2. CogniLens can keep history, compare runs, and provide explanation plus AI-style guidance.
3. The `eye` project can load a target page, start webcam gaze tracking, and show visual feedback such as heatmap and coverage.

## 2. Test Environment

Use the following local services:

- Main frontend: `http://127.0.0.1:5500/index.html`
- Main backend API: `http://127.0.0.1:8001/health`
- Eye tracking tool: `http://127.0.0.1:5600`

Prepare these files before the demo:

- [simple-page.html](C:/Users/16171/Documents/GitHub/DECO7381-Pitch/Project_14_Six_minus_one/backend/sample_input/simple-page.html)
- [dense-page.html](C:/Users/16171/Documents/GitHub/DECO7381-Pitch/Project_14_Six_minus_one/backend/sample_input/dense-page.html)

Optional:

- One ZIP package if you want to demonstrate ZIP upload support

## 3. Pre-demo Checklist

Complete these checks before the audience arrives:

- Confirm backend health page returns `{"status":"ok"}`.
- Confirm the main frontend page opens normally.
- Confirm the eye tracking page opens normally.
- Confirm your webcam works in the browser.
- Register the eye tracking origin `http://127.0.0.1:5600` at [GazeCloud registration](https://api.gazerecorder.com/register/).
- Keep one HTML file ready on the desktop for quick upload.
- Use stable lighting and sit centered in front of the camera.

## 4. Main Project Test Flow

### A. Landing page and navigation

What to test:

- Navigation bar is visible
- `Eye Tracking`, `History`, `Docs`, and `New Analysis` links work
- Upload page accepts supported file types

How to test:

1. Open `http://127.0.0.1:5500/index.html`.
2. Point out the main navigation.
3. Click `Docs`, then return to `New Analysis`.
4. Click `History`, then return to `New Analysis`.
5. Confirm the upload area says HTML or ZIP is supported.

Expected result:

- All pages load without error
- Navigation is consistent across pages

### B. File upload and analysis

What to test:

- File selection works
- Upload button is enabled only after valid file selection
- Backend analysis runs successfully
- Dashboard opens after analysis

How to test:

1. On the upload page, choose `simple-page.html`.
2. Confirm the selected file name appears.
3. Click `Analyze`.
4. Wait for the dashboard to open.

Expected result:

- Status changes from ready to analyzing
- Dashboard opens automatically
- Overall score and dimension bars appear

### C. Dashboard result reading

What to test:

- Overall score ring is shown
- Dimension scores are shown
- Explanation panel is populated
- Overall comments are populated

How to test:

1. On the dashboard, point to the score ring and source file name.
2. Read the four dimension bars.
3. Scroll the `Explanation` section and show issue descriptions.
4. Point to `Overall comments`.

Expected result:

- The result page is not empty
- At least one meaningful explanation block is shown

### D. Re-upload comparison

What to test:

- Previous session is stored
- Second analysis uses the previous one as baseline
- Comparison section updates

How to test:

1. Click `Re-upload`.
2. Upload `dense-page.html`.
3. Click `Analyze`.
4. Return to the dashboard and open the `Comparison` section.

Expected result:

- `Comparison` no longer says `No baseline`
- Delta values are shown
- Presenter can explain which dimension improved or worsened

### E. AI Assistant area

What to test:

- Assistant input accepts a question
- Assistant returns a response
- `Clear` resets the conversation

How to test:

1. In the dashboard assistant area, ask:
   `What should I fix first on this page?`
2. Wait for the response.
3. Ask one more follow-up question such as:
   `How can I improve readability?`
4. Click `Clear`.

Expected result:

- Messages appear in conversation order
- The assistant gives targeted advice based on the analysis result
- Clear resets the thread to the default prompt

### F. Print report

What to test:

- Print flow can be triggered from the dashboard

How to test:

1. Click `Print report`.
2. Show that the browser print dialog opens.
3. Cancel print if you do not need to actually print.

Expected result:

- Print dialog appears without breaking the page

### G. History page

What to test:

- History list is populated
- Search by file name works
- Opening a past run restores a dashboard session

How to test:

1. Open `History`.
2. Show that both uploaded files appear.
3. Use the search box to search `simple`.
4. Click `Open` on one result.

Expected result:

- History list updates
- Search narrows the list
- Clicking `Open` goes back to dashboard with that report loaded

## 5. Eye Project Test Flow

This part is based on the `eye/README.md` instructions and the current `eye` page UI.

### A. Page load and target URL loading

What to test:

- Eye tracking page opens
- Target URL field works
- Proxy-based page loading works

How to test:

1. Open `http://127.0.0.1:5600`.
2. Show the `Target URL` field.
3. Keep the default `https://example.com` or paste another simple public site.
4. Click `Load URL`.

Expected result:

- The page loads inside the iframe
- Status changes to indicate the page is loaded

### B. Start tracking and calibration

What to test:

- Tracking can start
- Camera permission prompt appears
- GazeCloud calibration overlay appears

How to test:

1. Click `Start Tracking`.
2. Allow camera permission.
3. Complete the GazeCloud calibration sequence.

Expected result:

- Status changes from idle to calibration, then to active tracking
- No immediate GazeCloud error appears

### C. Live gaze feedback

What to test:

- Moving gaze dot appears
- Heatmap updates while looking around
- Sample count increases
- Coverage map changes

How to test:

1. After calibration, move your eyes across different parts of the loaded page.
2. Pause briefly on headings, buttons, and body text.
3. Watch the dot, heatmap, sample counter, and coverage map.

Expected result:

- Gaze dot follows eye movement with small delay
- Heatmap becomes denser where you look longer
- `Samples` increases steadily
- `Coverage` percentage increases over time

### D. Pause, preview, and clear

What to test:

- `Pause` stops local updates
- `Show Camera Preview` toggles preview state
- `Clear Heatmap` resets the visual overlays

How to test:

1. Click `Pause`.
2. Confirm the dot and counters stop updating.
3. Click `Resume`.
4. Click `Show Camera Preview`, then click it again.
5. Click `Clear Heatmap`.

Expected result:

- Pause and resume work
- Preview toggles correctly
- Heatmap and coverage can be reset without reloading the page

## 6. Suggested Demo Order

For a smooth presentation, use this order:

1. Start on the CogniLens upload page.
2. Upload `simple-page.html` and show the first dashboard.
3. Re-upload `dense-page.html` and show comparison.
4. Show the AI assistant and ask one question.
5. Open `History` and restore one previous run.
6. Switch to the eye tracking page.
7. Load a simple URL and run calibration.
8. Show live dot, heatmap, and coverage.

## 7. Pass Criteria

The presentation can be considered successful if:

- Main project completes at least one full upload-to-dashboard cycle
- Comparison is shown using a second run
- History can reopen a saved report
- AI assistant responds at least once
- Eye tracking page completes calibration
- Eye tracking page shows visible heatmap or coverage change

## 8. Fallback Plan

Use these fallback options if something fails during the demo:

- If eye tracking calibration fails:
  explain the setup requirement and show the already-running UI, controls, and proxy loading flow
- If AI assistant is slow or unavailable:
  describe the existing rule-based explanation panel instead
- If ZIP upload is unstable:
  switch to HTML upload and continue the main analysis demo
- If history is empty:
  upload two pages first, then reopen history

## 9. Presenter Notes

- Speak in terms of user value, not only technical behavior.
- When showing scores, explain what the score means for cognitive accessibility.
- When showing eye tracking, explain that it is a lightweight validation tool rather than a lab-grade research setup.
