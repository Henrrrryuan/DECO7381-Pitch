# Cognitive Accessibility Evaluation Framework

This document supports the method design, scoring logic, MVP scope, and evaluation plan for **Project 14: Cognitive Accessibility Assistant for Web Content**.

The product is positioned as follows:

- Primary users: developers and designers
- Beneficiary users: people with cognitive disabilities, neurodivergent users, and users with communication or comprehension difficulties
- Product form: automated analysis and explanation first, with optional user validation afterward

---

## 1. Project Goals

According to the brief, this project should achieve the following:

1. Analyse cognitive accessibility risks in web content, including language complexity, layout density, spacing, animation usage, and visual hierarchy
2. Provide an interpretable dashboard or report interface that explains issues, impact, and improvement suggestions
3. Map analysis results to WCAG / COGA and ISO 9241-11 related standards
4. Provide a structured evaluation plan showing that the tool can improve clarity, comprehension, or usability

Based on this positioning, we designed the system as follows:

- The presentation layer uses four developer-friendly scoring dimensions
- The backend uses rule-based detection and explanation mechanisms to produce scores
- User testing is treated as a validation layer, not a required step in every development iteration

---

## 2. Four Core Dimensions

The project ultimately presents four dimensions to end users:

1. `Visual Complexity`
2. `Readability`
3. `Interaction & Distraction`
4. `Consistency`

Their relationship to the brief is:

| Dimension | Related brief topic | Core concern |
| --- | --- | --- |
| Visual Complexity | layout density, spacing, visual hierarchy | Whether the page feels crowded, whether hierarchy is clear, and whether information is easy to scan |
| Readability | language complexity, clarity, comprehension | Whether text is easy to read, understand, and act on |
| Interaction & Distraction | animation usage, cognitive effort, interruptions | Whether the page distracts users or adds unnecessary cognitive effort through interaction |
| Consistency | structural organisation, navigation patterns | Whether the structure, navigation, labels, and flow are stable and predictable |

---

## 3. Theoretical Sources and Mapping

This framework draws on cognitive accessibility methods referenced in the `inclusive-design-skills` repository, but does not copy its categories directly. Instead, those ideas are used as underlying analytical factors.

The source concepts include:

1. cognitive load
2. plain language
3. wayfinding and navigation
4. focus and attention
5. memory load
6. error prevention and recovery

The mapping is:

| Source concept | Mainly mapped to | Reason |
| --- | --- | --- |
| visual complexity / information density | Visual Complexity | Directly relates to layout density, crowding, and visual scanning burden |
| plain language / reading complexity | Readability | Directly relates to text comprehension difficulty |
| focus and attention | Visual Complexity / Interaction & Distraction | Influences both visual clarity and attention control |
| wayfinding/navigation | Consistency / Visual Complexity | Affects orientation and structural clarity |
| memory load | Consistency / Interaction & Distraction | Affects cross-page memory load and flow friction |
| error prevention/recovery | Interaction & Distraction / Consistency | Affects interaction burden and system predictability |

---

## 4. Final MVP Scope

To ensure that the project has both research depth and realistic implementation scope within the course timeframe, the MVP scope is defined as follows.

### 4.1 Must-Have Features

1. File upload and parsing
2. Four-dimension scoring
3. Overall score calculation
4. Issue list display
5. Explanation for each issue
6. Suggested fixes for each issue
7. Reupload comparison before and after changes
8. Basic standards mapping

### 4.2 Recommended Features

1. Highlight the corresponding page region when an issue is selected
2. Full-text read-aloud or reading highlight preview
3. More detailed drill-down by dimension
4. AI-assisted explanations or rewrite suggestions

### 4.3 Excluded from the MVP Main Flow

The following can be described as future work in the report:

1. Real-time eye-tracking integrated directly into scoring
2. Real user testing after every design change
3. Large-scale statistical correlation validation
4. Multi-format input support such as PDF, screenshots, live URLs, or Figma exports

---

## 5. Final MVP Rule Set

The MVP uses 11 rules distributed across the 4 dimensions.

### 5.1 Readability (3 rules)

| Rule ID | Rule | Threshold |
| --- | --- | --- |
| RD-1 | Average sentence length is too long | Average sentence length `> 20` words |
| RD-2 | Paragraph is too long | A single paragraph `> 4` sentences |
| RD-3 | Button or link label is vague | Vague labels such as `Next` or `Click here` appear |

### 5.2 Visual Complexity (3 rules)

| Rule ID | Rule | Threshold |
| --- | --- | --- |
| VC-1 | Too many elements on the first screen | Visible key elements on the first screen `> 12` |
| VC-2 | Cards or content blocks are too dense | Cards or items in the same region `> 6` |
| VC-3 | Too many sidebars or banners | Excessive sidebars, banners, or floating distractions are present |

### 5.3 Interaction & Distraction (3 rules)

| Rule ID | Rule | Threshold |
| --- | --- | --- |
| ID-1 | Autoplay media | Autoplay audio or video is present |
| ID-2 | Too many animated elements | Animated elements in the same viewport `> 2` |
| ID-3 | Competing CTAs | Primary action buttons in the same region `> 2` |

### 5.4 Consistency (2 rules)

| Rule ID | Rule | Threshold |
| --- | --- | --- |
| CS-1 | Heading structure gap | Heading levels jump or the structure is not continuous |
| CS-2 | Missing breadcrumb or progress indicator | No current-location cue in a multi-level or multi-step flow |

---

## 6. Detection Focus for Each Dimension

### 6.1 Visual Complexity

Definition:  
Whether the page is too crowded, has unclear hierarchy, or contains too much information for users to quickly decide where to look first.

Detection focus:

- The number of elements competing for attention on the first screen
- Whether content blocks are too dense within a single region
- Whether there are too many sidebars, banners, or floating components

Typical high-risk patterns:

- A homepage that opens with many buttons, cards, banners, or popups at once
- Users cannot quickly identify the main content area
- Non-primary-task content takes up too much visual space

### 6.2 Readability

Definition:  
Whether text is concise, understandable, and easy to grasp quickly.

Detection focus:

- Whether sentences are too long
- Whether paragraphs are too dense
- Whether button or link labels are vague

Typical high-risk patterns:

- Users need to reread the same sentence repeatedly
- Explanation text is too long and slows understanding
- Button labels do not clearly state the next action

### 6.3 Interaction & Distraction

Definition:  
Whether the page increases cognitive burden through animation, autoplay, or competing actions.

Detection focus:

- Autoplay media
- The number of animated elements
- Whether there are too many competing CTAs

Typical high-risk patterns:

- The page contains autoplay sound or video
- Multiple buttons on the same screen all appear to be primary actions
- Several moving elements compete for attention at the same time

### 6.4 Consistency

Definition:  
Whether the page structure, navigation, and progress cues are stable and predictable.

Detection focus:

- Whether heading levels are continuous
- Whether breadcrumbs or progress indicators are present

Typical high-risk patterns:

- Heading levels jump, making the page structure hard to understand
- In a multi-step task, users do not know which step they are currently on

---

## 7. Scoring Model

### 7.1 Dimension Weights

The recommended weights are:

| Dimension | Weight |
| --- | --- |
| Visual Complexity | 30% |
| Readability | 25% |
| Interaction & Distraction | 25% |
| Consistency | 20% |

### 7.2 Weighted Average Score

```text
Weighted Average Score
= Visual Complexity * 0.30
+ Readability * 0.25
+ Interaction & Distraction * 0.25
+ Consistency * 0.20
```

### 7.3 Final Overall Score

```text
Final Score
= 0.5 * min_dimension_score
+ 0.5 * weighted_average
```

Rationale:

- A plain average can hide severe weaknesses
- Cognitive accessibility has a strong weakest-link effect
- If one dimension performs very poorly, the overall experience can still be poor even when the others score well

For example:

- Visual Complexity = 90
- Readability = 88
- Interaction & Distraction = 85
- Consistency = 42

If we only use an average, the system may still appear acceptable. In practice, however, users may remain disoriented because of unstable navigation or structure.  
Therefore, the final score must allow the weakest dimension to meaningfully affect the result.

---

## 8. Penalty Mechanism

### 8.1 Simplified Penalty Formula

The MVP uses the following simplified formula:

```text
Penalty = Base Penalty * Severity
```

Where:

- `Base Penalty`: the base deduction for the rule
- `Severity`: the severity multiplier

The recommended severity multipliers are:

| Severity | Multiplier | Meaning |
| --- | --- | --- |
| Minor | 1 | Small-scale or isolated issue |
| Major | 2 | Clearly increases cognitive burden |
| Critical | 3 | May directly affect understanding or task completion |

### 8.2 Suggested Base Penalties

For the MVP, we can start with:

- Standard rules: `Base Penalty = 3`
- More serious rules: `Base Penalty = 4`

Example:

```text
Autoplay media
Base Penalty = 4
Severity = Major = 2
Penalty = 8
```

### 8.3 Why Severity Matters

Without severity:

- A minor issue
- A serious issue

could be treated as equivalent deductions, which is not logically reasonable.

By adding severity:

- The scoring better reflects real impact
- The dashboard becomes easier to explain
- It becomes easier to compare the score with real user experience during testing

---

## 9. Dimension Score Calculation

Recommended process:

1. Detect whether each rule is triggered
2. Determine the severity of each triggered rule
3. Calculate the deduction using `Penalty = Base * Severity`
4. Sum all deductions for the dimension
5. Use `100 - total_penalty` to get the dimension score
6. Clamp the lowest score at 0

```text
Dimension Score = max(0, 100 - Sum(Penalties))
```

At the MVP stage, a complex de-duplication model is not required, but the documentation should state:

> The current version uses a simplified penalty model. More advanced rule overlap handling and normalization remain future optimisation directions.

---

## 10. Boundaries and Limitations

To keep the project scope realistic, the following boundaries should be clearly stated.

### 10.1 Input Boundaries

For the MVP, it is recommended to support one main input type first, such as:

- HTML files
- Webpage fragments

It is not recommended for the first version to support all of the following simultaneously:

- PDF
- Images
- Live URL fetching
- Mixed multi-source analysis

### 10.2 Detection Boundaries

The system detects **proxy indicators of cognitive load**, not a full model of human cognition.

In other words:

- The system can recognise page features associated with cognitive burden
- But it should not claim to accurately simulate how the human brain understands a webpage

### 10.3 Scoring Boundaries

The project outputs:

- decision-support scores for developers
- heuristic cognitive accessibility scores

rather than:

- medical diagnoses
- legal certification
- official WCAG compliance decisions

### 10.4 User Testing Boundaries

User testing is used to validate whether the model is helpful, not to claim large-scale universal findings.

Therefore, the report should prefer wording such as:

- pilot evaluation
- preliminary evidence
- initial validation

---

## 11. Dashboard Output Structure

At a minimum, the dashboard should include:

1. Four dimension scores
2. The final overall score
3. An issue list
4. The severity of each issue
5. An explanation of why each issue matters
6. A suggested fix for each issue
7. Comparison results before and after reupload

If time allows, it is recommended to add:

1. Highlighting of the corresponding page region when an issue is selected
2. Standard tags for each issue such as brief / WCAG / COGA / ISO

A suggested issue card structure is:

```text
Issue: 3 primary action buttons appear in the same region
Dimension: Interaction & Distraction
Severity: Major
Impact: Increases decision burden and weakens focus on the main task
Suggestion: Keep 1 primary button and convert the others into secondary buttons or text links
```

---

## 12. Standards Mapping

### 12.1 WCAG / COGA Mapping

| Dimension | Related meaning in standards |
| --- | --- |
| Visual Complexity | Clear structure, reduced visual distraction, and support for content scanning |
| Readability | Understandable language, plain language, and reduced reading burden |
| Interaction & Distraction | Reduced autoplay, irrelevant animation, and interruptive elements |
| Consistency | Consistent navigation, consistent identification, and predictable interaction and flow |

### 12.2 ISO 9241-11 Mapping

| ISO factor | Interpretation in this project |
| --- | --- |
| Effectiveness | Users can understand page information more accurately and complete tasks successfully |
| Efficiency | The time required to understand and operate the page is reduced |
| Satisfaction | Users subjectively feel that the experience is clearer, easier, and less frustrating |

---

## 13. Evaluation Plan

### 13.1 Minimum Viable Evaluation

For the MVP, a small before / after evaluation is recommended:

- Sample size: 5 participants
- Comparison method: original version vs improved version
- Goal: verify whether the tool helps pages become easier to understand and faster to complete

### 13.2 Minimum Question Set

Two core questions are sufficient:

1. Is the page easier to understand?
2. Is the task faster to complete?

If a slightly stronger evaluation is needed, add:

3. Is the page clearer?
4. Is the page less distracting?

### 13.3 Suggested Metrics

| Metric | Validation target |
| --- | --- |
| Task completion time | Efficiency |
| Comprehension question accuracy | Effectiveness |
| Subjective clarity rating | Satisfaction |
| Subjective ease rating | Satisfaction / cognitive load |

### 13.4 Recommended Reporting Language

Recommended wording:

> This project uses a small-scale pilot evaluation to compare the original and revised webpage versions in terms of comprehension efficiency and subjective clarity, providing preliminary evidence for the effectiveness of the scoring framework.

If a more research-oriented tone is desired:

> This evaluation focuses on whether the system score and user performance show directionally consistent changes, rather than aiming for large-scale statistical significance at the MVP stage.

---

## 14. Future Work

The following items can be explicitly described as future work rather than included in the first implementation:

1. More advanced rule grouping and de-duplication models
2. Normalisation across pages and content lengths
3. Integration of eye-tracking data with rule-based scoring
4. Large-sample correlation studies
5. Personalised recommendations for different cognitive profiles such as ADHD, dyslexia, or autism
6. Multi-format input support such as PDF, screenshots, or live URL analysis
7. Browser-plugin support for in-context analysis during browsing

---

## 15. Final Conclusion

The final strategy used in this project is:

1. Use four dimensions as a developer-friendly presentation layer
2. Use 11 heuristic rules as the core MVP detection model
3. Use `Final = 0.5 * min_dimension_score + 0.5 * weighted_average` as the overall scoring formula
4. Use `Penalty = Base * Severity` to implement an explainable and feasible deduction mechanism
5. Use a small before / after user evaluation as initial validation
6. Keep eye-tracking and advanced statistical validation as future work

This allows the project to satisfy three goals at the same time:

- It can be built
- It can be explained clearly
- It can score well academically
