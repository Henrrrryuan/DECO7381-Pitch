from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
import re
from typing import Iterable

FIRST_VIEWPORT_TAG_WINDOW = 120
IO4_THRESHOLD = 4

FOCUS_TAGS = {
    "a",
    "button",
    "form",
    "h1",
    "h2",
    "h3",
    "iframe",
    "img",
    "input",
    "select",
    "textarea",
    "video",
}
PROMINENT_HEADING_TAGS = {"h1", "h2"}
ACTIONABLE_INPUT_TYPES = {"button", "submit", "image", "reset"}
REGION_TAGS = {"article", "aside", "body", "div", "footer", "header", "main", "nav", "ol", "section", "ul"}
ITEM_TAGS = {"article", "li"}
ITEM_HINT_KEYWORDS = ("card", "item", "tile", "product", "post", "entry", "panel")
CTA_HINT_KEYWORDS = (
    "cta",
    "primary",
    "hero",
    "start",
    "continue",
    "next",
    "submit",
    "signup",
    "sign-up",
    "sign-in",
    "register",
    "apply",
    "buy",
    "book",
    "download",
    "checkout",
)
SIDEBAR_BANNER_KEYWORDS = ("sidebar", "side-bar", "banner", "promo", "advert", "ads", "ad-banner")


class VisualHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.focus_elements_count = 0
        self.sidebar_banner_count = 0
        self.competing_action_count = 0
        self.prominent_heading_count = 0
        self.start_tag_count = 0
        self.detected_sidebar_banner_keywords: set[str] = set()
        self.focus_element_locations: list[dict[str, str]] = []
        self.sidebar_banner_locations: list[dict[str, str]] = []
        self.competing_action_locations: list[dict[str, str]] = []
        self.prominent_heading_locations: list[dict[str, str]] = []
        self._stack: list[tuple[str, str, bool]] = []
        self._node_seq = 0
        self._region_item_counts: dict[str, int] = defaultdict(int)
        self._region_tags: dict[str, str] = {"root": "body"}
        self._region_summaries: dict[str, str] = {"root": "body"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs)
        self._pop_until(tag)

    def handle_endtag(self, tag: str) -> None:
        self._pop_until(tag)

    def _on_start(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_map = self._attrs_map(attrs)
        attrs_text = self._attrs_text(attrs)
        self.start_tag_count += 1
        self._node_seq += 1
        node_id = f"n{self._node_seq}"
        is_region = tag in REGION_TAGS
        self._stack.append((tag, node_id, is_region))
        if is_region:
            self._region_tags[node_id] = tag
            self._region_summaries[node_id] = self._tag_summary(tag, attrs)

        is_first_viewport = self.start_tag_count <= FIRST_VIEWPORT_TAG_WINDOW
        if is_first_viewport and (
            tag in FOCUS_TAGS
            or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS)
            or self._contains_any(attrs_text, CTA_HINT_KEYWORDS)
        ):
            self.focus_elements_count += 1
            if len(self.focus_element_locations) < 12:
                self.focus_element_locations.append({"tag": tag, "summary": self._tag_summary(tag, attrs)})

        if is_first_viewport and self._is_competing_action(tag, attrs_text, attrs_map):
            self.competing_action_count += 1
            if len(self.competing_action_locations) < 10:
                self.competing_action_locations.append({"tag": tag, "summary": self._tag_summary(tag, attrs)})

        if is_first_viewport and tag in PROMINENT_HEADING_TAGS:
            self.prominent_heading_count += 1
            if len(self.prominent_heading_locations) < 5:
                self.prominent_heading_locations.append({"tag": tag, "summary": self._tag_summary(tag, attrs)})

        if tag in ITEM_TAGS or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS):
            self._region_item_counts[self._nearest_region_id()] += 1

        matched_keywords = self._matched_sidebar_banner_keywords(attrs_text, SIDEBAR_BANNER_KEYWORDS)
        if tag == "aside" or matched_keywords:
            self.sidebar_banner_count += 1
            self.detected_sidebar_banner_keywords.update(matched_keywords)
            if len(self.sidebar_banner_locations) < 8:
                self.sidebar_banner_locations.append({"tag": tag, "summary": self._tag_summary(tag, attrs)})

    def _nearest_region_id(self) -> str:
        for _tag, node_id, is_region in reversed(self._stack[:-1]):
            if is_region:
                return node_id
        return "root"

    def _pop_until(self, tag: str) -> None:
        for index in range(len(self._stack) - 1, -1, -1):
            open_tag, _, _ = self._stack[index]
            if open_tag == tag:
                del self._stack[index:]
                return

    @staticmethod
    def _attrs_map(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key.lower(): (value or "").lower() for key, value in attrs if key}

    @staticmethod
    def _attrs_text(attrs: list[tuple[str, str | None]]) -> str:
        parts: list[str] = []
        for key, value in attrs:
            if key:
                parts.append(key.lower())
                if value:
                    parts.append(value.lower())
        return " ".join(parts)

    @staticmethod
    def _contains_any(text: str, keywords: Iterable[str]) -> bool:
        lowered = text.lower()
        return any(keyword in lowered for keyword in keywords)

    @staticmethod
    def _matched_sidebar_banner_keywords(text: str, keywords: Iterable[str]) -> set[str]:
        lowered = text.lower()
        return {
            keyword
            for keyword in keywords
            if re.search(rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])", lowered)
        }

    @staticmethod
    def _is_competing_action(tag: str, attrs_text: str, attrs_map: dict[str, str]) -> bool:
        if tag == "button":
            return True
        if tag == "a" and attrs_map.get("href") and not attrs_map["href"].startswith("#"):
            return True
        if tag == "input" and attrs_map.get("type", "text") in ACTIONABLE_INPUT_TYPES:
            return True
        if attrs_map.get("role") == "button":
            return True
        return any(keyword in attrs_text for keyword in CTA_HINT_KEYWORDS)

    @staticmethod
    def _tag_summary(tag: str, attrs: list[tuple[str, str | None]]) -> str:
        element_id = ""
        classes: list[str] = []
        for key, value in attrs:
            if key == "id" and value:
                element_id = f"#{value}"
            if key == "class" and value:
                classes.extend(value.split())
        class_text = "." + ".".join(classes) if classes else ""
        return f"{tag}{element_id}{class_text}"
