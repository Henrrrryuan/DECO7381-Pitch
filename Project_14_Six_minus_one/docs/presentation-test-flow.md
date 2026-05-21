# Presentation Test Flow

This document is a practical demo and pre-submission smoke-test script for CogniLens.

CogniLens should be presented as a cognitive accessibility risk-signal detector. It demonstrates how static DOM/content analysis, a visual complexity map, issue-level findings, affected-element highlighting, and redesign guidance can support a designer/developer review. It is not a full WCAG/COGA compliance checker.

## 1. Demo Goal

The presentation should demonstrate that:

1. CogniLens can analyze a URL, single HTML file, or ZIP website package.
2. The dashboard can show Visual Complexity evidence before issue-level findings.
3. Accessibility Findings can explain detected cognitive accessibility risk signals, highlight affected elements, and suggest first redesign moves.
4. History and Print can preserve and share a report.
5. Eye Tracking can be used as optional supporting evidence, not proof of accessibility or cognitive load.

## 2. Test Environment

Use these local services:

- React frontend: `http://127.0.0.1:5173`
- Backend health check: `http://127.0.0.1:8001/health`
- Eye Tracking page via Vite proxy: `http://127.0.0.1:5173/eye/`
- Eye Tracking page directly from backend: `http://127.0.0.1:8001/eye/`

Start the backend:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Start the frontend:

```bash
cd frontend-react
npm run dev
```

Recommended demo files:

- `backend/sample_input/simple-page.html`
- `backend/sample_input/sc-test.html`
- `backend/sample_input/lcc-long-content-test.html`
- `backend/sample_input/nc-navigation-complexity-test.html`
- `backend/sample_input/phs-heading-structure-test.html`
- `backend/sample_input/interaction-distraction-test.html`
- `backend/sample_input/ei-excessive-interruptions-test.html`

Keep one small, self-contained HTML file ready as the fallback demo input.

## 3. Pre-Demo Checklist

- Confirm `GET /health` returns `{"status":"ok"}`.
- Confirm `http://127.0.0.1:5173/` opens normally.
- Confirm `History` opens.
- Confirm `Eye Tracking` opens, but keep it optional.
- Confirm at least one sample HTML file completes a full New Analysis flow.
- Confirm a fresh report appears in History.
- Clear or avoid old History reports if they were generated before recent detector fixes.
- Keep a URL fallback ready, preferably a local/static URL.
- Avoid large ZIP packages, large media files, or login-heavy sites during the live demo.

## 4. Main Demo Flow

### A. New Analysis Input

What to test:

- URL, HTML, and ZIP input modes are visible.
- File type and size checks behave professionally.
- Analysis transitions to the loading page and then dashboard.

How to test:

1. Open `http://127.0.0.1:5173/`.
2. Choose Website URL, Upload HTML, or Upload ZIP.
3. Use a stable local/static input.
4. Click `Analyze`.

Expected result:

- The loading page appears.
- Analysis completes without getting stuck.
- The Dashboard opens with a report id and webpage preview.

### B. Visual Complexity

What to test:

- Visual Complexity is the first dashboard section.
- Visual Complexity Score appears.
- Complexity Map Preview appears when evidence is available.
- The complexity map can be toggled in the right preview.

How to test:

1. Stay on the Visual Complexity section.
2. Point out the score and map legend.
3. Click `View complexity map` or the `Complexity Map Preview`.
4. Click again to return to the webpage preview.
5. Open `Calculation details` if a formula/evidence explanation is needed.

Expected result:

- The right preview toggles between webpage preview and complexity map view.
- The map is framed as a complexity overview, not eye tracking or AI vision.
- The explanation stays cautious: busier areas may increase cognitive load and should be reviewed with issue findings.

### C. Accessibility Findings

What to test:

- The section switcher moves to issue-level findings.
- Focus profiles work as review lenses.
- Issue cards expand and collapse.

How to test:

1. Click `Accessibility Findings`.
2. Select a focus profile such as `Mild Cognitive Impairment` or `ADHD-related Needs`.
3. Open one or more detected issue cards.

Expected result:

- Issue categories are visible.
- Profile selection changes the review lens without claiming diagnosis.
- Issue cards display COGA/ISO framing, concise affected elements, and rationale.

### D. Affected Elements and Highlighting

What to test:

- Affected element cards are concise.
- Only the first few elements show by default when many locations exist.
- `+X more` expands and `Show less` collapses.
- Clicking an affected element highlights the corresponding preview region.
- Clicking the same element again clears the active highlight.

How to test:

1. Open an issue with multiple affected elements.
2. Click one element card.
3. Confirm the right preview highlights the page element.
4. Click the same element again.
5. Confirm the highlight clears.
6. Click a different element.

Expected result:

- Active state moves to the selected element.
- Highlighting matches the affected element.
- Element numbering remains stable.

### E. Guidance Popover

What to test:

- Clicking an affected element opens concise guidance.
- Guidance includes:
  - Why This Matters
  - First Redesign Move
  - Suggested Action for This Element
- Guidance is tied to the selected location where available.

How to test:

1. Click two different affected elements under the same issue.
2. Compare the guidance text.

Expected result:

- The rule-level explanation remains consistent.
- The selected-element wording changes enough to explain why the current element matters.
- The text avoids compliance claims and uses cautious wording such as `may increase cognitive load`.

### F. History

What to test:

- Fresh reports are saved.
- Search and reopen work.
- Visual Complexity and Eye Evidence summaries appear where available.

How to test:

1. Open `History`.
2. Search for the source name.
3. Reopen a fresh report.

Expected result:

- History restores the dashboard report.
- Reopened reports still show issue findings and preview content.

### G. Print Report

What to test:

- Print opens from the current report and from a History report.
- Print report contains summary, profile framing, issue cards, guidance, standards mapping, and affected elements.
- Print report does not show unnecessary category count badges.

How to test:

1. Click `Print` on a fresh dashboard report.
2. Cancel the browser print dialog.
3. Reopen the same report from History and click `Print` again.

Expected result:

- Print layout is readable.
- No duplicate section count badge appears in issue category headers.

## 5. Optional Eye Tracking Support Flow

Eye Tracking is optional supporting evidence. It should not be described as proof of accessibility, a complete validation layer, or a full cognitive-load measurement.

What to test:

- Eye Tracking page opens.
- Target URL / HTML / ZIP loading works for a simple page.
- Start Tracking starts GazeCloudAPI calibration.
- Camera preview and calibration card appear before active tracking.
- Once tracking is active, the calibration preview hides so the user can focus on the webpage.
- Heatmap, gaze dot, visited map, pause, clear, and save controls work where available.

How to test:

1. Open `http://127.0.0.1:5173/eye/`.
2. Load a simple static URL or HTML file.
3. Click `Start Tracking`.
4. Allow camera access.
5. Complete calibration.
6. Confirm status reaches active tracking.
7. Pause and show the heatmap if needed.
8. Save the session only when a valid `run_id` is linked.

Expected result:

- Eye Tracking works as optional behavioural evidence.
- Main CogniLens analysis remains useful even if Eye Tracking is skipped.

## 6. Suggested Live Demo Order

1. Start on `New Analysis`.
2. Upload or load one stable local/static page.
3. Show Visual Complexity score and complexity map preview.
4. Toggle the right preview between webpage and complexity map.
5. Switch to `Accessibility Findings`.
6. Choose a focus profile.
7. Expand issue cards.
8. Click affected elements and show highlight.
9. Open guidance popover.
10. Show Print.
11. Open History and reopen the fresh report.
12. If time and setup are stable, show Eye Tracking as optional supporting evidence.

## 7. Pass Criteria

The demo is successful if:

- One full URL/HTML/ZIP analysis reaches Dashboard.
- Visual Complexity and Accessibility Findings are both explainable.
- At least one affected element can be highlighted.
- Guidance explains why the risk signal may increase cognitive load.
- History can reopen the report.
- Print opens without layout-breaking artifacts.
- Eye Tracking is clearly framed as optional support if shown.

## 8. Fallback Plan

- If ZIP upload is slow or unstable, switch to a small single HTML file.
- If URL analysis fails on an external site, use a local/static URL.
- If Visual Complexity rendering is slow, continue with Accessibility Findings.
- If Eye Tracking calibration fails, explain the optional nature of the feature and continue with the main report.
- If History contains old reports, run a fresh New Analysis and use that report for Print/History.

## 9. Presenter Notes

- Say `risk signal`, not `compliance failure`.
- Say `may increase cognitive load`, not `proves cognitive load`.
- Say `optional supporting evidence`, not `eye-tracking proof`.
- Say `complexity map`, not `AI vision` or `visual salience analysis`.
- Explain trade-offs: reducing cognitive load may require simplifying, grouping, delaying, or lowering the priority of some interactive/visual elements.
