# CogniLens Visual Complexity README

This document explains the Visual Complexity / ViCRAM-inspired module in CogniLens for the final prototype codebase submission. It covers the purpose of the feature, which open-source and research sources informed it, how the implementation works in this project, what data it depends on, and the limits of the current prototype.

## Purpose in CogniLens

The Visual Complexity module is a static page-analysis layer for CogniLens. The main CogniLens analysis detects cognitive accessibility issues from webpage structure, content, interaction patterns, and visual hierarchy. The Visual Complexity module adds a page-level and grid-level complexity view so designers can see where visual load is concentrated on a webpage.

In the current prototype, the Visual Complexity workflow is used to:

- load a target webpage by URL, HTML input, or ZIP website upload
- render the page in a browser environment before analysis
- capture a full-page screenshot
- divide the rendered page into a grid, currently `20 x 20`
- estimate grid-level complexity from words, images, and layout/section cues
- calculate a page-level Visual Complexity Score
- draw a colour-coded complexity map over the rendered webpage screenshot
- provide hover explanations for busier grid cells
- save visual complexity evidence into a CogniLens analysis history record
- display the complexity map and summary information in the Dashboard, History, and Print report views

This feature is not intended to make a clinical judgement about users. It is a prototype mechanism for showing how visual density and layout complexity could support cognitive accessibility review.

## Relevant Files

```text
Project_14_Six_minus_one/
  VICRAM_README.md                         This document
  backend/
    app/routers/vicram.py                  backend route for visual complexity analysis
    analyzers/vicram_complexity.py          rendering, screenshot capture, grid scoring, colour mapping
    adapters/persistence/history_store.py   persistence layer for saved visual complexity evidence
  frontend-react/
    src/lib/pendingVicramSession.js         temporary ViCRAM result cache between loading and dashboard
    src/legacy/dashboardApp.js              dashboard integration, grid overlay, tooltip, report modal
    src/pages/VicramPage.jsx                standalone visual complexity test page
    src/pages/HistoryPage.jsx               saved complexity map display in History
    src/lib/printAndDownload.js             print report integration
```

## External Research and Third-Party Source

### Eclipse ACTF / org.eclipse.actf.examples ViCRAM

This project adapts the logic and interaction concept from the open-source Eclipse ACTF example project, particularly the ViCRAM-related `org.eclipse.actf.examples` code structure.

Original source repository:

```text
https://eclipse.googlesource.com/actf/org.eclipse.actf.examples
```

Reference clone command:

```bash
git clone https://eclipse.googlesource.com/actf/org.eclipse.actf.examples
```

The original ACTF / ViCRAM implementation is Java/Eclipse based. CogniLens does not run the Eclipse RCP application directly. Instead, this project reimplements the relevant idea in the CogniLens stack:

- Python backend analysis instead of Java/Eclipse plug-ins
- Playwright browser rendering instead of the original Eclipse browser/view pipeline
- PNG screenshot capture and SVG overlay generation
- React dashboard integration instead of Eclipse views
- saved history and print-report support

The ACTF source should be treated as third-party open-source material. The original Eclipse ACTF code headers reference the Eclipse Public License. Any final public or commercial release should review the exact license terms of the ACTF source used.

### Visual Complexity Research Paper

The scoring concept is also informed by the supplied research paper:

```text
Automated prediction of visual complexity of web pages: Tools and evaluations
International Journal of Human-Computer Studies, 145 (2021), 102523
DOI: 10.1016/j.ijhcs.2020.102523
Keywords: Visual complexity; Prediction; Perception; Automated tool
```

The paper supports the project rationale that visual complexity can be predicted from measurable page features and used as an aid for evaluating webpage perception and usability. CogniLens uses this research direction as a design and prototyping basis, not as a claim of exact replication of the paper's full evaluation method.

## Runtime Requirements

The Visual Complexity module requires:

- the CogniLens FastAPI backend
- Playwright and its browser runtime
- a local or reachable target webpage
- a modern browser for the React dashboard
- enough time for the target page to render before screenshot capture

For local development, install backend dependencies:

```bash
python -m pip install -r requirements.txt
```

If Playwright browsers are not installed, install them:

```bash
python -m playwright install chromium
```

Start the backend:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Start the React frontend:

```bash
cd frontend-react
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## How to Use the Feature

Recommended workflow:

1. Open CogniLens.
2. Start a new analysis.
3. Provide a target webpage by URL, HTML file, or ZIP website upload.
4. Wait for the main analysis and Visual Complexity analysis to finish.
5. Open the Dashboard.
6. Use the Visual Complexity panel to review the page-level Visual Complexity Score.
7. Click `View complexity map` to show the grid overlay on the rendered webpage.
8. Hover over orange or red grid cells to see why that area is considered visually busier.
9. Click `Calculation details` to view the formula, debug counts, highest grid cells, and full summary.
10. Use History or Print if the evidence needs to be reviewed later.

## Input Modes

The Visual Complexity module supports the same target-source patterns as the main CogniLens analysis.

### URL input

The backend renders the target URL with Playwright, waits for the page to settle, captures a screenshot, and extracts visible text, image, and layout cue rectangles.

Some sites may not render correctly if they block automation, require login, use strict bot detection, or depend on third-party scripts that fail in the local environment.

### HTML file upload

For a single `.html` or `.htm` file, CogniLens prepares a local preview route and runs visual complexity analysis against that rendered preview.

### ZIP website upload

For static websites with HTML, CSS, JavaScript, and image assets, CogniLens prepares a preview route from the ZIP package and analyzes the rendered preview. This is useful for coursework prototypes and local test pages.

## Data Dependencies

The module does not depend on a fixed dataset. It depends on the target page supplied by the user:

- a URL
- uploaded HTML
- uploaded ZIP website files
- existing CogniLens analysis history if the result should be saved with a report

The analysis output depends on the rendered page state at capture time. Dynamic content, lazy-loaded images, animations, modals, sticky banners, and viewport size can affect the result.

## What Data Is Generated or Stored

During a Visual Complexity analysis, CogniLens generates:

- page title and source label
- rendered page width and height
- full-page screenshot
- grid size
- grid cell data
- word count estimates per grid cell
- image count estimates per grid cell
- Top Left Corner Count estimates per grid cell
- grid-level Visual Complexity Score values
- page-level Visual Complexity Score
- colour values for the complexity map
- SVG grid overlay
- summary report text

When saved to History, the stored evidence is linked to a CogniLens analysis report so it can be reopened later.

## Current Scoring Model

CogniLens uses a ViCRAM-inspired scoring formula at grid level:

```text
Grid Visual Complexity Score =
(1.743 + 0.097 * Top Left Corner Count + 0.053 * Word Count + 0.003 * Images) / 10
```

The page-level score is calculated from page-level word, image, and Top Left Corner Count totals, then clamped to the `0-10` display range.

Grid colours are assigned by ranking grid cells and constraining the strongest possible colour by the whole-page Visual Complexity Score. This means a page with a low overall score should not become fully red only because one cell is locally higher than the rest of the page.

The current implementation uses rendered coordinates where possible:

- text is mapped by visible text rectangle positions
- images are mapped by rendered image positions
- layout/section cues are mapped by area overlap rather than only by centre point

The hover explanation on high-complexity cells is intentionally plain-language. It explains causes such as dense text, concentrated image content, or layout boundaries rather than exposing raw feature counts to end users.

## Privacy and Ethical Considerations

The Visual Complexity module analyzes webpage content rather than user behaviour. It does not require camera access and does not collect biometric data.

However, it can process user-provided webpages or uploaded coursework files, so the following boundaries apply:

- Do not upload private or confidential pages unless the project environment is trusted.
- Do not treat the Visual Complexity Score as a universal accessibility judgement.
- Use the score as supporting evidence for design review, not as a replacement for user testing.
- Explain that visually complex areas may require designer interpretation.
- Avoid presenting the result as a diagnosis of cognitive ability.

## Limitations

The Visual Complexity module is a prototype and has important limitations:

- The score is an approximation, not a validated clinical or universal usability score.
- Dynamic pages can change after the screenshot is captured.
- Some websites block automated rendering or do not load all assets in Playwright.
- Lazy-loaded content may be missed if it appears after the capture stage.
- The grid can simplify or blur fine-grained layout details.
- The Top Left Corner Count approximation is adapted for this prototype and may not exactly match the original Java implementation.
- Colour interpretation depends on the current ranking and whole-page score constraint.
- A high score should be reviewed with the related accessibility findings and, where possible, user feedback.

## Internal CogniLens Contribution Around the Source Logic

The external ACTF / ViCRAM source and visual complexity paper provide the conceptual basis. CogniLens adds the product-specific implementation:

- converts the Java/Eclipse workflow into a Python service
- renders target pages with Playwright before analysis
- supports URL, HTML, and ZIP website inputs
- generates a screenshot-backed complexity map
- maps complexity evidence into the existing dashboard and history workflow
- connects visual complexity with cognitive accessibility findings
- adds hover explanations for high-complexity grid cells
- includes print-report support for both Visual Complexity and Accessibility Findings

This means the third-party source is used as an analytical reference, while the integration, rendering workflow, dashboard experience, persistence, and reporting are implemented in CogniLens.

## Quick Verification Checklist

Use this checklist before submitting the final codebase:

- Backend starts successfully on `127.0.0.1:8001`.
- React frontend starts successfully on `127.0.0.1:5173`.
- URL analysis produces a Visual Complexity Score.
- HTML upload analysis produces a Visual Complexity Score.
- ZIP upload analysis renders assets correctly before generating the complexity map.
- `View complexity map` toggles between webpage preview and grid overlay.
- Orange/red grid cells show hover explanations.
- `Calculation details` opens the summary modal.
- History can reopen the saved visual complexity map.
- Print includes the Visual Complexity section and Accessibility Findings section.


