from __future__ import annotations

from typing import Any

from ..adapters.input.url_input import collect_inline_script_texts
from ..analyzers import (
    analyze_consistency,
    analyze_information_overload,
    analyze_interaction,
    analyze_readability,
)
from ..analyzers.location_utils import sanitize_analysis_locations
from ..adapters.persistence.history_store import has_history_run, record_compare_pair, save_analysis_run
from ..scoring import calculate_overall_score
from ..schemas import AnalysisResult


def analyze_html(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> AnalysisResult:
    merged_js_sources = list(js_sources or [])
    merged_js_sources.extend(collect_inline_script_texts(html))

    dimensions = [
        analyze_readability(html),
        analyze_information_overload(
            html,
            css_sources=css_sources,
            js_sources=merged_js_sources,
        ),
        analyze_interaction(html, js_sources=merged_js_sources),
        analyze_consistency(html),
    ]
    analysis = calculate_overall_score(dimensions)
    return sanitize_analysis_locations(analysis, html)


def build_analysis_response(
    analysis: AnalysisResult,
    *,
    html_content: str,
    source_name: str | None,
    baseline_run_id: str | None,
) -> dict[str, Any]:
    saved_run = save_analysis_run(analysis, html_content, source_name)
    resolved_baseline_run_id = None
    if baseline_run_id and has_history_run(baseline_run_id):
        record_compare_pair(baseline_run_id, saved_run.run_id)
        resolved_baseline_run_id = baseline_run_id

    payload = analysis.to_dict()
    payload["run"] = saved_run.to_dict()
    payload["html_content"] = html_content
    payload["baseline_run_id"] = resolved_baseline_run_id
    return payload

