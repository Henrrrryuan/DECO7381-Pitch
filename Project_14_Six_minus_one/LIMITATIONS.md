# Known Limitations and Future Work

CogniLens performs **static HTML/DOM analysis** guided by rule-based heuristics. It is **not** a full browser accessibility engine and does not execute page scripts as an end-user browser would.

Consequently, all detector outputs constitute **engineering approximations** of cognitive/accessibility friction. They remain useful for coursework-scale review and repeatable regression testing, yet they must not be mistaken for conformance certification, a full audit, or perceptual verification.

CogniLens is a cognitive accessibility **risk-signal detector**. It supports review and redesign discussion; it does not guarantee accessibility and does not detect every possible issue on every website.

---

## Detector limitations

### DT-1

Dense passages **split deliberately across multiple block elements** (lists, captions, sequential paragraphs without long single-node runs) may **fall below per-block thresholds** even when the concatenated passage is objectively heavy. Aggregation across arbitrary layout boundaries remains a heuristic gap.

### LC-1

**Domain-specific vocabulary** (medicine, law, HCI standards) routinely registers as morphologically complex. Technical **educational** pages therefore exhibit higher baseline alarm rates unrelated to authoring quality. Threshold tuning trades **recall vs noise** without semantic awareness of disciplinary jargon.

### PHS-1

The **multiple H1** stance is intentionally **stricter than permissive HTML5 outline algorithms** might suggest for certain document idioms. The project prioritizes **cognitive landmark clarity** and predictable heading ladders over validator-style permissiveness toward repeated top-level headings in long-form composites.

### VO-1

Estimation relies on **structural proxies** within the DOM (component counts, list density, categorized interactive/link patterns). Without rendering, **true viewport clutter**, whitespace relief, typography scale, and color-driven crowding cannot be reconstructed faithfully.

The Visual Complexity map is an **approximate heuristic overview**, not a full visual-salience model, eye-tracking model, or certification mechanism.

### EI-1

Classification continues to hinge on **DOM-shaped cues** accessible in the snapshot. **Deeply nested** interruption scaffolding may be summarized or suppressed inconsistently depending on wrappers. **`script`-mediated behaviors** invisible in the uploaded HTML—including delayed modals absent from markup—cannot be classified.

### AMC-1

Detection leans on **inline styles and observable animation attributes**. **External stylesheets**, **keyframes bundled off-page**, **GPU/accelerometer-driven motion**, or **interaction-gated animations** invisible in provided markup may produce **silent misses** despite user-perceived distraction.

### ZIP, URL, and dynamic-site limits

The ZIP upload boundary is **100MB compressed size**. Large packages can still create browser memory pressure, slow preview extraction, or unstable live-demo behaviour, especially when they contain large media files, bundled dependencies, virtual environments, or nested project archives.

URL analysis and uploaded HTML/ZIP analysis are most reliable for static or semi-static pages. Fully dynamic websites, login-heavy flows, bot-protected pages, client-rendered states, and pages that depend on user interaction may not be represented completely in a static snapshot.

### Spacing and visual hierarchy limits

Spacing is represented indirectly through layout density, structural organisation, visual hierarchy proxies, and visual-complexity evidence. CogniLens is not an independent computed-CSS spacing audit and does not fully evaluate responsive breakpoints or all rendered whitespace.

### Eye Tracking limits

Eye Tracking is an optional supporting evidence workflow. It is not proof of accessibility, not a clinical cognitive-load measurement, and not a replacement for expert review or user testing.

---

## Highlighting limitations

Highlight placement ultimately depends on **CSS selectors resolving within the analyzer’s BeautifulSoup projection** plus sanitize-time **dedupe keys**. Pages with heavy dynamic IDs, portals, or duplicated templates can still degenerate toward ** brittle paths** despite extended grounding.

Evidence-first detectors such as **AMC** and **EI** may intentionally retain **broader textual or snippet-level evidence** rather than pinching every datum to one atomized element—the trade-off favors **explainability** over **pixel-level anchoring**.

---

## Future work

- **Browser-runtime analysis** integrating headless Chrome or equivalent for layout-faithful snapshots.
- **Computed CSS** ingestion (resolved display, stacking, typography) to tighten VO-linked estimates.
- **Linked stylesheet parsing** (and inlined `@keyframes`) for animation completeness.
- **Visual rendering models** (screenshot segmentation, saliency heuristics) orthogonal to markup-only parses.
- **Semantic understanding** (readability stratified by audience, glossary detection) to soften LC vocabulary bias.
- **Richer heading models** reconciling landmarks, banners, section containers, and ARIA-labelled headings without collapsing policy intent.
- **Viewport-aware density estimation** correlating VO-style tallies with scroll segments and spatial overlap.
