# Known Limitations and Future Work

CogniLens performs **static HTML analysis** guided by rule-based heuristics. It is **not** a full browser accessibility engine and does not execute page scripts as an end-user browser would.

Consequently, all detector outputs constitute **engineering approximations** of cognitive/accessibility friction. They remain useful for coursework-scale auditing and repeatable regression testing, yet they must not be mistaken for conformance certification or perceptual verification.

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

### EI-1

Classification continues to hinge on **DOM-shaped cues** accessible in the snapshot. **Deeply nested** interruption scaffolding may be summarized or suppressed inconsistently depending on wrappers. **`script`-mediated behaviors** invisible in the uploaded HTML—including delayed modals absent from markup—cannot be classified.

### AMC-1

Detection leans on **inline styles and observable animation attributes**. **External stylesheets**, **keyframes bundled off-page**, **GPU/accelerometer-driven motion**, or **interaction-gated animations** invisible in provided markup may produce **silent misses** despite user-perceived distraction.

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
