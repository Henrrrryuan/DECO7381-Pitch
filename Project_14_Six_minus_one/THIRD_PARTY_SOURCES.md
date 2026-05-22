# CogniLens Third-party Sources and External Dependencies

This document lists external APIs, open-source libraries, browser/platform APIs, local data dependencies, assets, and AI-assisted development support that should be disclosed with the final CogniLens submission.

CogniLens does not use a third-party research dataset or hosted third-party database service. It analyzes user-provided or team-created webpage inputs and stores local prototype history with SQLite.

## External APIs and Reference Material

| Source | Version / status | License / terms | Used for | Where used |
| --- | --- | --- | --- | --- |
| GazeCloudAPI / GazeRecorder | Runtime script from `https://api.gazerecorder.com/GazeCloudAPI.js` | Provider terms from GazeRecorder/GazeCloudAPI website | Optional webcam-based gaze-coordinate support for heatmaps, element-hit detection, Eye Evidence scoring, and History display | `eye/index.html`, `eye/app.js`, `EYE_TRACKING_README.md` |
| GazeCloudAPI registration | External service | Provider terms from GazeRecorder/GazeCloudAPI website | Registering local/demo origins if required by the gaze API provider | Eye Tracking setup |
| GazeCloud reference/example files | Third-party reference material | Treat as third-party reference/example material, not team-authored code | Integration reference for GazeCloudAPI | `eye/GazeCloud-master/` |
| ACTF / ViCRAM-inspired visual complexity concept | Research/reference inspiration, not bundled code | Cite original source in report bibliography where used | Conceptual framing for visual complexity scoring and map explanation | `VICRAM_README.md`, visual complexity implementation |

## Open-source Frontend Libraries

These packages are declared in `frontend-react/package.json` and resolved in `frontend-react/package-lock.json`.

| Library | Declared / resolved version | License | Used for |
| --- | --- | --- | --- |
| React | `^19.2.5` / `19.2.5` | MIT | Component-based frontend UI |
| React DOM | `^19.2.5` / `19.2.5` | MIT | Browser rendering for React |
| React Router DOM | `^7.14.2` / `7.14.2` | MIT | Client-side routing |
| Vite | `^8.0.10` / `8.0.10` | MIT | Frontend development server and production build tooling |
| `@vitejs/plugin-react` | `^6.0.1` / `6.0.1` | MIT | Vite React integration |
| ESLint | `^10.2.1` / `10.2.1` | MIT | Frontend linting |
| `eslint-plugin-react-hooks` | `^7.1.1` / `7.1.1` | MIT | React hooks linting |
| `eslint-plugin-react-refresh` | `^0.5.2` / `0.5.2` | MIT | React refresh linting |
| `@eslint/js` | `^10.0.1` / `10.0.1` | MIT | ESLint JavaScript rules |
| Playwright | `^1.59.1` / `1.59.1` | Apache-2.0 | Browser verification support |

## Open-source Backend Libraries

These packages are declared in `requirements.txt`. Installed development versions are included where observed during final verification; compatible ranges may install newer patch versions.

| Library | Declared / observed version | License | Used for |
| --- | --- | --- | --- |
| FastAPI | `>=0.115.0,<0.116.0` / `0.115.14` | MIT | Backend API framework |
| Uvicorn | `>=0.30.0` / `0.35.0` | BSD-3-Clause | Local ASGI server |
| Pydantic | `>=2.0,<3` / `2.10.3` | MIT | Request/response models |
| python-multipart | unpinned / `0.0.24` | Apache-2.0 | File upload parsing |
| Beautiful Soup 4 | unpinned / `4.12.3` | MIT | HTML parsing for detector analysis |
| certifi | unpinned / `2025.4.26` | MPL-2.0 | Certificate bundle support |
| Playwright for Python | unpinned / `1.59.0` | Apache-2.0 | URL snapshot/rendering support for visual complexity and page analysis workflows |

## Local Database and Data Dependencies

| Technology | Version / source | License | Used for | External dataset? |
| --- | --- | --- | --- | --- |
| SQLite via Python `sqlite3` | Python standard library binding to SQLite | Public domain SQLite library; Python standard library license applies to binding | Local analysis history, issue details, visual complexity summaries, and saved Eye Evidence sessions | No |

The default development database is created locally at:

```text
backend/analysis_history.sqlite3
```

This database is generated runtime data and should not be included in the final codebase ZIP.

No external third-party dataset is required. Test/demo pages under `backend/sample_input/` and test fixtures are team-created project materials unless otherwise stated.

## Browser and Web Platform APIs

CogniLens also uses standard browser APIs:

- Fetch API for frontend-backend requests
- File and Blob APIs for HTML/ZIP upload flows
- iframe loading for previewing target pages
- DOM APIs such as `querySelector`, `elementFromPoint`, and `elementsFromPoint` for preview highlighting and lightweight Eye Evidence element detection
- Canvas-style rendering concepts for heatmap/coverage visualisation

These are platform APIs rather than third-party libraries, but they are important implementation dependencies.

## Assets and Media

| Asset | Source / status | Where used |
| --- | --- | --- |
| `frontend-react/public/logo-mascot.png` | Team-provided project mascot asset. If the original was AI-generated or sourced externally, disclose that source in the report appendix. | Frontend branding |
| OpenDyslexic font files in `frontend-react/public/fonts/opendyslexic/` | OpenDyslexic font family, typically distributed under the SIL Open Font License. Confirm exact upstream package/source in the report appendix if required. | Optional accessibility font styling |
| Sample HTML pages in `backend/sample_input/` | Team-created demo/test pages | Detector and dashboard demonstration |

## AI Tools

AI tools used during development are disclosed in:

- `docs/Team_AI_Declaration_Cover_Sheet.pdf`
- `docs/AI_Prompt.pdf`
- `docs/AI_PROMPTS_USED.md`

| Tool | Used for |
| --- | --- |
| ChatGPT | Planning, explanation, wording support, report/README drafting, prompt generation |
| Codex | Codebase inspection, implementation support, debugging, documentation updates |
| Cursor | AI-assisted code editing and refactoring support |

All AI-assisted outputs were expected to be reviewed, adapted, integrated, and tested by team members before final submission.
