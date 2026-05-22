# AI Prompts Used During Code Creation

This appendix summarises the AI-assisted programming prompts used during the CogniLens codebase development.

The source evidence is the submitted PDF appendix `Project_14_Six_minus_one/docs/AI_Prompt.pdf`, which was prepared from GitHub commit history and major development phases. These prompts are reconstructed representative implementation briefs based on the repository history and development work. They are not claimed to be verbatim copies of every AI interaction.

The prompts below preserve the core intent of the PDF appendix in a searchable Markdown form for markers reviewing the final codebase.

## 1. MVP Foundation and First Cognitive Accessibility Analyzers

Commit evidence in the PDF: `9cd9330`, `e82776f`, `b00d9e5`, `80302b9`, `d254c4a`, `310bc6b`

Representative contributors listed in the PDF: Henrrryuan, YanyaL, runhong, gldwen

Prompt purpose:
- Build the first working CogniLens MVP for cognitive accessibility review.
- Set up a FastAPI backend, basic frontend flow, response schemas, and sample pages.
- Implement early deterministic analyzers for readability/content complexity, visual or information overload, interaction/distraction, and consistency-like signals.
- Return structured issue data including issue id, title, description, evidence, suggestion, and affected element data where possible.
- Validate that HTML analysis works and that missing fields do not crash the UI.

Representative implementation brief:

> Build the first working MVP for a cognitive accessibility assistant. Create backend analysis routes, structured response fields for dimensions, issues, evidence, and scoring, and first rule-based analyzers. Connect a simple frontend flow that can trigger analysis and display returned findings. Keep the output explainable and ready for later dashboard issue cards.

## 2. Upload Workflow, Report History, Comparison, Search, and Print Support

Commit evidence in the PDF: `48aef05`, `8296307`, `feb71be`, `a8554ec`, `7a93e5b`

Representative contributors listed in the PDF: YanyaL, gldwen

Prompt purpose:
- Extend CogniLens beyond a one-off analyzer into a repeatable report workflow.
- Add HTML and ZIP upload support for local/static websites.
- Validate file type, empty archives, and missing HTML entry files.
- Add SQLite-backed analysis history, report reopening, comparison support where available, search, and print actions.
- Preserve existing single HTML and URL analysis paths.

Representative implementation brief:

> Extend CogniLens from a single-page analyzer into a report-based workflow. Add HTML/ZIP upload validation, preserve relative preview assets where possible, store each analysis run in local SQLite history, and provide UI actions for search, reopening, comparison, and print review.

## 3. Unified FastAPI App and Eye Tracking Support

Commit evidence in the PDF: `fc5e0a9`, `ad9bec7`, `0c5da99`, `b500ecd`, `50ac4bd`

Representative contributors listed in the PDF: YanyaL

Prompt purpose:
- Integrate the separate eye-tracking prototype into the main CogniLens app.
- Serve the Eye Tracking page through the same FastAPI product.
- Add target-page loading/proxy support for the eye-tracking workflow.
- Store session metadata and link sessions to analysis reports when a `run_id` is available.
- Keep Eye Tracking as optional supporting evidence rather than replacing the main static analysis workflow.

Representative implementation brief:

> Integrate the existing eye-tracking prototype into CogniLens as an optional behavioural evidence workflow. Serve it through the main FastAPI app, connect sessions to report history, keep static assets and routes clearly separated, and ensure reports without eye evidence continue to work.

## 4. Rule Mapping, Scoring Language, Issue Guidance, and Backend Layering

Commit evidence in the PDF: `70eeaf0`, `248b9fd`, `f2202f6`, `2704673`, `7526141`, `72eaa9c`

Representative contributors listed in the PDF: Henrrryuan, runhong, gldwen

Prompt purpose:
- Refactor backend ownership into clearer app, routers, services, adapters, analyzers, and schemas.
- Map detector outputs to cognitive accessibility guidance and recognised standards framing.
- Make issue cards more understandable with risk-oriented language and practical recommendations.
- Preserve existing API behaviour where possible.

Representative implementation brief:

> Refactor CogniLens so backend ownership is clearer and dashboard findings are easier to interpret. Improve rule metadata, standards mapping, scoring language, and issue guidance without breaking the existing user workflow.

## 5. React/Vite Migration and Accessibility Widget Expansion

Commit evidence in the PDF: `2ee0a78`, `c6124ea`, `b7b5e11`, `b5cbd34`, `5cc1d8a`, `54f4d06`, `1c98343`, `df01755`, `29ee9e2`, `82cf53f`, `ca1f71b`

Representative contributors listed in the PDF: YanyaL, runhong, gldwen

Prompt purpose:
- Move the frontend into a React/Vite workflow.
- Preserve existing analysis, dashboard, history, and reporting behaviour during migration.
- Improve page structure, reusable components, and frontend development commands.
- Expand accessibility-support UI where relevant while keeping CogniLens focused on cognitive accessibility review.

Representative implementation brief:

> Migrate the frontend to React/Vite while preserving the current analysis flow. Keep backend routes stable, rebuild key pages as React views, and ensure dashboard, history, print, and accessibility-support UI continue to work after migration.

## 6. Eye Evidence, History Detail, Heatmaps, and Print/Download Modularisation

Commit evidence in the PDF: `898f4c2`, `2d2d939`, `8f6e70e`, `927055f`, `5346dcc`, `fade214`, `109411d`, `54ad391`, `c255bcd`

Representative contributors listed in the PDF: YanyaL, runhong

Prompt purpose:
- Improve the optional Eye Tracking evidence workflow.
- Add temporary HTML upload, scroll-synced visited map, element-hit logic, and heatmap details.
- Convert raw gaze samples into more explainable element-level evidence summaries.
- Keep eye evidence separate from the main rule-based findings and usable in History/Print.

Representative implementation brief:

> Upgrade the eye-tracking evidence workflow so history reports show meaningful behavioural evidence instead of raw percentages only. Connect gaze samples to page elements, calculate concise element-level evidence, and display it in History and heatmap detail views.

## 7. Detector-Based Refactor, Dashboard Stability, Priority Lens, and Issue-Card Cleanup

Commit evidence in the PDF: `0043724`, `8729104`, `c531fbc`, `af739b0`, `84e6f0d`, `cd3bde0`, `f52210c`, `a819632`, `e29b56a`

Representative contributors listed in the PDF: gldwen, Henrrryuan, YanyaL

Prompt purpose:
- Refine detector ownership and frontend rendering for issue-based findings.
- Improve dashboard stability, issue-card clarity, and affected element presentation.
- Reduce duplicated or overly verbose issue evidence where possible.
- Keep element index mapping and preview highlighting stable.

Representative implementation brief:

> Refactor detector-specific dashboard behaviour so each issue can present concise evidence, stable affected elements, and clearer guidance. Keep highlighting reliable and avoid changes that break element index mapping or report history.

## 8. Visual Complexity / ViCRAM Added to the Main Product Workflow

Commit evidence in the PDF: `cc20357`, `45c584f`, `4d6faf1`, `5bb6170`, `6e74d66`, `db9641f`, `b168961`, `c4db979`

Representative contributors listed in the PDF: gldwen, Henrrryuan, Dylan(yanya) liu, runhong

Prompt purpose:
- Add Visual Complexity as a first-class product module.
- Connect visual complexity evidence to dashboard, loading, history, and report persistence.
- Keep Visual Complexity separate from Eye Evidence.
- Present the complexity map as a heuristic overview, not as eye tracking or full rendered visual-salience analysis.

Representative implementation brief:

> Add Visual Complexity to the main CogniLens workflow. Generate and persist a complexity score and map, display it before issue-level findings, and ensure History separates Visual Complexity evidence from Eye Evidence.

## 9. Final Stabilisation: Calibration, Heatmap Visibility, ZIP Limits, and UI Polish

Commit evidence in the PDF: `484796c`, `972d71b`, `1e7172a`, `542981f`, `a02e7d5`, `b350075`, `d707fd8`, `13a7ce5`

Representative contributors listed in the PDF: runhong, Dylan(yanya) liu, Henrrryuan

Prompt purpose:
- Stabilise the final demo workflow across New Analysis, Visual Complexity, Accessibility Findings, Eye Tracking, History, and Print.
- Improve calibration UI, heatmap visibility, upload boundary handling, and dashboard copy.
- Keep wording cautious: CogniLens is a cognitive accessibility risk-signal detector, not a full WCAG/COGA compliance checker.
- Preserve core detector thresholds, scoring, highlight matching, and data structures during UI/documentation polish.

Representative implementation brief:

> Prepare CogniLens for final demo and submission. Polish the dashboard, upload boundaries, calibration flow, heatmap visibility, print/report presentation, and documentation wording. Do not change detector thresholds, scoring, highlight matching, or issue index mapping unless a confirmed blocker is found.

## Scope Note

These AI prompts supported code design, debugging, UI wording, documentation, and implementation planning. They do not replace the submitted source code, tests, README, source attribution, or team AI declaration. The final codebase should be reviewed together with:

- `Project_14_Six_minus_one/docs/AI_Prompt.pdf`
- `Project_14_Six_minus_one/docs/Team_AI_Declaration_Cover_Sheet.pdf`
- `Project_14_Six_minus_one/THIRD_PARTY_SOURCES.md`
- `Project_14_Six_minus_one/LIMITATIONS.md`
