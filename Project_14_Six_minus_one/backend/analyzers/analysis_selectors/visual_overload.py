from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from ..location_utils import get_tag_summary, looks_like_visual_component, stable_selector
from .interaction_helpers import _looks_like_modal_trigger
from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location, visible_text
from .visual_parser import VisualHTMLParser

VISIBLE_ELEMENT_THRESHOLD = 20
INTERACTIVE_ELEMENT_THRESHOLD = 8

_VO_MAX_LOCATIONS = 8

# Lightweight keyword buckets (attrs id/class/role + tag context only — no layout).
_CTA_ATTR_HINTS = (
    "cta",
    "primary",
    "hero",
    "signup",
    "sign-up",
    "buy",
    "checkout",
    "submit",
    "register",
    "apply",
    "download",
    "banner",
    "promo",
)
_REGION_ATTR_HINTS = (
    "nav",
    "menu",
    "sidebar",
    "side-bar",
    "masthead",
    "toolbar",
    "carousel",
    "slider",
    "card",
    "tile",
    "product",
    "grid",
    "deck",
)

_VO_NAV_BLOB_HINTS = frozenset({
    "breadcrumb",
    "breadcrumbs",
    "menubar",
    "navigation",
    "sidebar",
    "side-bar",
    "tablist",
    "tab-list",
    "tabs",
    "tabpanel",
    "navbar",
    "nav-bar",
})

_VO_MEDIA_EXTRA_BLOB = frozenset({"carousel", "slider", "banner", "hero"})

_VO_CARD_GRID_BLOB = frozenset({
    "card",
    "tile",
    "grid",
    "deck",
    "panel",
    "dashboard",
    "product",
    "carousel",
    "slider",
})

_VO_NAV_STRUCTURE_ATTR_HINTS = (
    "nav",
    "menu",
    "sidebar",
    "side-bar",
    "toc",
    "sub-nav",
    "subnav",
    "navigation",
)


def detect_visual_overload_selector(context: dict[str, Any]):
    return detect_visual_overload(context["soup"], context["visual_parser"])


def is_interactive(tag: Tag) -> bool:
    if (tag.name or "").lower() == "a" and _looks_like_modal_trigger(tag):
        return False
    return bool(
        tag.name in {"button", "select", "textarea"}
        or (tag.name == "a" and tag.get("href"))
        or tag.name == "input"
        or tag.get("role") in {"button", "link"}
    )


def _attrs_blob(tag: Tag) -> str:
    parts = [
        str(tag.get("id") or ""),
        str(tag.get("class") or ""),
        str(tag.get("role") or ""),
        str(tag.get("aria-label") or ""),
    ]
    return " ".join(parts).lower()


def _count_descendant_interactives(tag: Tag, *, limit: int = 48) -> int:
    n = 0
    for desc in tag.descendants:
        if isinstance(desc, Tag) and is_interactive(desc):
            n += 1
            if n >= limit:
                break
    return n


def _sibling_interactive_cluster_bonus(tag: Tag) -> int:
    """+3 when this tag is interactive and shares a parent with another interactive sibling."""
    parent = tag.parent
    if not isinstance(parent, Tag) or not is_interactive(tag):
        return 0
    siblings = [c for c in parent.children if isinstance(c, Tag)]
    interactive_siblings = sum(1 for s in siblings if is_interactive(s))
    return 3 if interactive_siblings >= 2 else 0


def _list_cluster_bonus(tag: Tag) -> int:
    """+2 for dense ul/ol item lists (competing row/card patterns)."""
    name = (tag.name or "").lower()
    if name not in {"ul", "ol"}:
        return 0
    items = [c for c in tag.find_all("li", recursive=False) if isinstance(c, Tag)]
    return 2 if len(items) >= 3 else (1 if len(items) == 2 else 0)


def _vo_contributor_score(tag: Tag, stream_index: int, stream: list[Tag]) -> int:
    """
    Higher score = stronger attention-anchor / overload evidence (not issue scoring).

    Deterministic: uses only tag name, attrs, subtree interactives, sibling patterns.
    """
    del stream_index, stream  # API stability for future stream-aware signals
    score = 0
    name = (tag.name or "").lower()
    blob = _attrs_blob(tag)

    # +4 — interactive / form controls
    if is_interactive(tag):
        score += 4
    if name == "form":
        score += 4

    # +4 — media / rich visuals
    if name in {"img", "video", "audio", "iframe", "canvas"}:
        score += 4
    if name == "svg":
        score += 4

    # +3 — landmarks & component hints (avoid double-count with looks_like)
    if name in {"nav"}:
        score += 3
    if looks_like_visual_component(tag):
        score += 3
    elif any(k in blob for k in _REGION_ATTR_HINTS):
        score += 3
    elif any(k in blob for k in _CTA_ATTR_HINTS):
        score += 2

    # +3 — repeated sibling interactives (competing controls)
    score += _sibling_interactive_cluster_bonus(tag)

    # +2 — subtree packs multiple controls / list grids
    ic = _count_descendant_interactives(tag)
    if ic >= 4:
        score += 2
    elif ic == 3:
        score += 1

    score += _list_cluster_bonus(tag)

    # +1 — section/article with real density (competing regions)
    if name in {"section", "article"}:
        if ic >= 1 or len(visible_text(tag).strip()) >= 72:
            score += 1

    # Penalties — suppress arbitrary readable chrome
    if name == "p":
        score -= 6
        if tag.find(["a", "button", "input", "img"]):
            score += 3

    if name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        score -= 4
        if any(k in blob for k in _REGION_ATTR_HINTS):
            score += 3

    if name in {"div", "span"} and not looks_like_visual_component(tag):
        if ic == 0 and not is_interactive(tag) and name == "div":
            score -= 3

    return score


def _ancestor_tag_names(tag: Tag) -> set[str]:
    names: set[str] = set()
    parent: Tag | None = tag.parent if isinstance(tag.parent, Tag) else None
    while isinstance(parent, Tag):
        nm = (parent.name or "").lower()
        if nm:
            names.add(nm)
        parent = parent.parent if isinstance(parent.parent, Tag) else None
    return names


def _is_navigation_list_context(tag: Tag) -> bool:
    """True when ul/ol/li belong to nav landmarks or navigation-like chrome (not card grids)."""
    name = (tag.name or "").lower()
    if name not in {"ul", "ol", "li"}:
        return False
    if tag.find_parent("nav") is not None:
        return True
    if "nav" in _ancestor_tag_names(tag):
        return True
    blob = _attrs_blob(tag)
    parent: Tag | None = tag.parent if isinstance(tag.parent, Tag) else None
    while isinstance(parent, Tag):
        blob = f"{blob} {_attrs_blob(parent)}"
        parent = parent.parent if isinstance(parent.parent, Tag) else None
    return any(hint in blob for hint in _VO_NAV_STRUCTURE_ATTR_HINTS)


def vo_contributor_category(tag: Tag) -> str:
    """
    Presentation-only attention-source bucket for VO-1 evidence rows.

    Mutually exclusive priority (first match wins). Uses tag name + attrs + ancestor nav.
    """
    name = (tag.name or "").lower()
    blob = _attrs_blob(tag)
    role = str(tag.get("role") or "").lower()
    ancestors = _ancestor_tag_names(tag)

    # 1 — Navigation / wayfinding density
    if name == "nav":
        return "navigation_density"
    if name == "a" and tag.get("href") and "nav" in ancestors:
        return "navigation_density"
    if role in {"navigation", "tablist", "tab", "menubar", "menu"}:
        return "navigation_density"
    if any(h in blob for h in _VO_NAV_BLOB_HINTS):
        return "navigation_density"
    if name == "a" and tag.get("href") and any(h in blob for h in ("nav", "menu", "breadcrumb", "tab")):
        return "navigation_density"
    if name in {"ul", "ol", "li"} and _is_navigation_list_context(tag):
        return "navigation_density"

    # 2 — Media / motion-rich competition
    if name in {"img", "video", "audio", "iframe", "canvas", "svg"}:
        return "media_competition"
    if any(k in blob for k in _VO_MEDIA_EXTRA_BLOB):
        return "media_competition"

    # 3 — Interactive / control competition
    if is_interactive(tag) or name == "form":
        return "interactive_competition"

    # 4 — Cards, grids, repeated blocks
    items = [c for c in tag.find_all("li", recursive=False)] if name in {"ul", "ol"} else []
    if len(items) >= 2:
        return "card_grid_density"
    if looks_like_visual_component(tag):
        return "card_grid_density"
    if any(k in blob for k in _VO_CARD_GRID_BLOB):
        return "card_grid_density"

    # 5 — Structural / dense regions (fallback)
    if name in {"section", "article", "main", "aside", "header", "footer", "div"}:
        return "structural_density"

    return "structural_density"


def collect_visual_overload_contributors(elements: list[Tag], *, max_locations: int = _VO_MAX_LOCATIONS) -> list[Tag]:
    """
    Rank candidates by `_vo_contributor_score`, stable tie-break by DOM-stream index.

    One pass over score-sorted tags preserves deterministic ordering (no random ties).
    """
    if not elements:
        return []

    scored: list[tuple[int, int, Tag]] = []
    for idx, tag in enumerate(elements):
        scored.append((_vo_contributor_score(tag, idx, elements), idx, tag))

    scored.sort(key=lambda row: (-row[0], row[1]))

    selected: list[Tag] = []
    seen: set[int] = set()
    for _, _, t in scored:
        if len(selected) >= max_locations:
            break
        marker = id(t)
        if marker in seen:
            continue
        seen.add(marker)
        selected.append(t)

    return selected[:max_locations]


def vo_grounded_location(tag: Tag) -> dict[str, Any]:
    """Stable selector + summary + attention-source category (presentation only)."""
    payload = tag_location(tag)
    payload["selector"] = stable_selector(tag)
    payload["summary"] = get_tag_summary(tag)
    payload["contributorCategory"] = vo_contributor_category(tag)
    return payload


def detect_visual_overload(soup: BeautifulSoup, parser: VisualHTMLParser):
    first_viewport_elements = [
        tag for index, tag in enumerate(soup.find_all(True), start=1)
        if index <= 120 and tag.name not in {"html", "head", "body", "script", "style", "meta", "link"}
    ]
    interactive_count = len([tag for tag in first_viewport_elements if is_interactive(tag)])
    if len(first_viewport_elements) <= VISIBLE_ELEMENT_THRESHOLD and interactive_count <= INTERACTIVE_ELEMENT_THRESHOLD:
        return None
    overload_amount = max(
        len(first_viewport_elements) - VISIBLE_ELEMENT_THRESHOLD,
        interactive_count - INTERACTIVE_ELEMENT_THRESHOLD,
    )
    contributors = collect_visual_overload_contributors(first_viewport_elements, max_locations=_VO_MAX_LOCATIONS)
    return make_issue(
        rule_id="VO-1",
        title="Visual Overload",
        base_penalty=REGULAR_BASE_PENALTY,
        description=(
            "A high concentration of elements early in the DOM structure can divide attention and reduce focus "
            "(early-page structural density heuristic)."
        ),
        suggestion=(
            "Reduce competing actions and dense blocks in the early-page markup; group related content into clearer regions."
        ),
        evidence={
            "visible_element_count": len(first_viewport_elements),
            "interactive_element_count": interactive_count,
            "overload_margin": overload_amount,
            "parser_focus_elements_count": parser.focus_elements_count,
            "threshold": {
                "maxVisibleElements": VISIBLE_ELEMENT_THRESHOLD,
                "maxInteractiveElements": INTERACTIVE_ELEMENT_THRESHOLD,
            },
            "contributor_count": len(contributors),
        },
        locations=[vo_grounded_location(tag) for tag in contributors],
    )
