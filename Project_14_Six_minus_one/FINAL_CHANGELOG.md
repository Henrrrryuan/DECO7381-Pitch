# Final Change Log

## Overview

This phase focused on improving detector correctness, grounding stability, sanitize behavior, and reducing false positives discovered through forensic QA audits. Work extended across multiple rule identifiers (dense text, language complexity, heading structure, visual overload, interruptions, navigation-related dimensions, and post-sanitize consistency).

There were **no major detector redesigns**. Iteration stayed within the existing heuristic, static-analysis architecture. Changes concentrated on the following axes:

- **Detector precision**: narrowing conditions that produced misleading hits on structured pages (especially educational and standards-heavy markup).
- **Selector grounding**: disambiguating repeated DOM shapes so highlights map to intended evidence nodes.
- **Sanitize consistency**: aligning reported locations with what the frontend can uniquely resolve after deduplication and highlightability gates.
- **Frontend highlighting correctness**: reducing ambiguous `querySelector`-level collisions that produced multi-match chips or wrong anchors.
- **Cross-detector isolation**: shared helpers (modal-launcher characterization, launcher-adjacent treatment, ghost cleanup) applied without entangling unrelated rule scoring.

---

## Implemented Improvements

### Global sanitize / ghost cleanup

Cross-cutting sanitizer passes can leave **survivor-less issues**: every location collapses during grounding, dedupe, or scope filters, yet the detector row would still surface. Earlier DT-specific handling was generalized so any dimension can drop incoherent “empty card” payloads after sanitize.

Mechanisms involved:

- **`_drop_post_sanitize_ghost_issues`**: removes issues that should no longer contribute to the UX aftersanitize.
- **`_issue_should_remain_after_sanitize`**: encodes retention rules—for example distinguishing **deliberately structural/non-highlight rows** from accidental empties—so legitimate document-level findings are **preserved** while **accidental empty issue cards** are removed.

Applicable across detector outputs whose locations pass through sanitization pathways, including representations tied to rules such as **LC-1**, **SC-1**, **VO-1**, **WIP-1**, **NC-1**, and **DT-1**, coordinated with LC/PHS-specific branches in **`location_utils`**.

---

### EI-1 Excessive Interruptions

Evidence collection was tightened around **launcher vs interruption** distinctions:

- **Modal launcher filtering** via **`_looks_like_modal_trigger`**: markup that opens dialogs or drawers (attribute patterns and intent-bearing tokens) is treated as launcher-shaped rather than a free-standing interruption cue, reducing **trigger-link false positives** on dashboards.
- **`is_initially_visible()` ancestor walk**: visibility and hiding semantics are evaluated along an **inclusive ancestor chain** (`hidden`, `aria-hidden`, closed `<dialog>` scaffolding, common inline concealment), not only on the leaf node—so submerged trigger chrome does not inflate counts the same way as visible overlays.

**Native `<dialog open>`**, cookie-consent style overlays, and other genuinely visible interruption surfaces remain eligible when the heuristic stack considers them visibly active and structurally interruption-like—the goal was precision on **launcher-adjacent** noise, not removal of plausible runtime interruptions that appear in static snapshots.

---

### DT-1 Dense Text Detection

**WCAG-style dotted numbering** (e.g. **2.2.2**, **3.1.5**) inflated **sentence-derived** triggers when sentence splitting treated internal periods as boundaries. **`_mask_dotted_numeric_tokens`** (paired with **`split_sentences`** in **`text_utils`**) replaces dotted numeric sequences before regex-based splitting so citation-style numbering does not fragment prose into artefactual multi-sentence blocks.

Outcome on forensic pages such as **111.html**: dense-text firing on standards-reference excerpts was eliminated where the dominant failure mode was punctuation-driven **false sentence inflation**, not genuinely dense prose.

---

### LC-1 Language Complexity

Improvements clustered into three themes:

1. **Nav / aside exclusion** and **launcher container filtering** so navigation chrome and launcher-adjacent copy do not dominate language-complexity evidence.
2. **Card duplication cleanup**: dedupe and candidate ordering avoid double-counting the same card surface across link wrappers and inner text blocks where the detector previously emitted redundant locations.
3. **Grounding refinement**: **`_lc_extended_text_selector_path`**, **`_lc_grounding_selector`**, and sanitize integration prefer **extended section-scoped selector paths** (e.g. chaining through **`section#…`**) over repeated **`header:nth-of-type(…) > p:nth-of-type(…)`** shapes that collide under global `select`. The **111.html collision** pattern—one short path matching many nodes—is addressed at **grounding/sanitize**, without changing lexical scoring thresholds.

---

### PHS-1 Poor Heading Structure

Heading evidence benefits from stronger **sanitize-time dedupe** and **extended selector paths** (section-anchored chains, mirroring LC-style ancestor extension) via **`_phs_extended_heading_selector_path`** / **`_phs_grounding_selector`** integration. Frontend consumers received **fewer ambiguous multi-match** selectors; **multiple H1** documentary evidence remains represented, while **individual highlight chips** resolve to **unique heading nodes** where the DOM admits a discriminating path.

---

### VO-1 Visual Overload

Refinements include **launcher-like link suppression** (`_looks_like_modal_trigger`-aware tallies where anchor-shaped controls open panels rather than act as standalone focal clutter), refined **navigation categorization**, and broader **navigation list context detection**—reducing inflated visual-component counts driven by markup that resembles interactive chrome rather than page body complexity.

---

## QA Summary

| Detector | Status        | Notes |
|----------|----------------|-------|
| **DT-1** | **GOOD**       | Dotted numbering masking removed a major false-positive class on standards-heavy prose; ghosts dropped post-sanitize. |
| **LC-1** | **GOOD**       | Nav/card/noise exclusions plus extended grounding; 111 collision class addressed via longer unique paths. Remaining misses are lexical-domain limits (see **`LIMITATIONS.md`**). |
| **PHS-1** | **GOOD**      | Dedupe + extended selectors; structural rows preserved where non-highlight findings are intentional. |
| **VO-1** | **PARTIAL**    | Structural HTML proxies improved; viewport-true density remains out of scope for static parsing. |
| **EI-1** | **PARTIAL**    | Launcher filtering and ancestor visibility materially reduced FP; nested interruption shapes and JS-driven timing still heuristic. |
| **NC-1** | **GOOD**       | Stable post-sanitize behavior with ghost filtering; markup irregularities can still perturb nav metrics. |
| **WIP-1** | **PARTIAL**   | CTA lock/sanitize tightened; distinguishing decorative vs consequential prominence remains heuristic. |
| **AMC-1** | **SPECIAL-CASE** | Evidence-first, animation-facing rule; stylesheet/runtime animation blind spots documented separately. |

---

## Overall Outcome

Detectors and downstream highlighting became **materially more stable** on **`111.html`** and on targeted forensic fixtures: fewer phantom cards, fewer launcher-driven false positives, and fewer selector collisions against repeated header templates.

Outstanding gaps are predominantly **policy choices** (e.g. conservative heading policies) **or inherent heuristic limits** of static markup analysis rather than regressions attributable to inconsistent implementation—as catalogued under **`LIMITATIONS.md`**.
