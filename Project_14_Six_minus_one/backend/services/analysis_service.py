from __future__ import annotations

from typing import Any

from ..adapters.input.url_input import collect_inline_script_texts
from ..analyzers import analyze_detector_rules
from ..analyzers.location_utils import sanitize_analysis_locations
from ..adapters.persistence.history_store import has_history_run, record_compare_pair, save_analysis_run
from ..schemas import AnalysisResult


def analyze_html(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> AnalysisResult:
    merged_js_sources = list(js_sources or [])
    # Inline scripts are merged with external JS so motion and interaction rules see both sources.
    merged_js_sources.extend(collect_inline_script_texts(html))

    dimensions = analyze_detector_rules(
        html,
        css_sources=css_sources,
        js_sources=merged_js_sources,
    )
    analysis = AnalysisResult(dimensions=dimensions)
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
    # Comparison links are only recorded when the requested baseline still exists.
    if baseline_run_id and has_history_run(baseline_run_id):
        record_compare_pair(baseline_run_id, saved_run.run_id)
        resolved_baseline_run_id = baseline_run_id

    payload = analysis.to_dict()
    payload["run"] = saved_run.to_dict()
    payload["html_content"] = html_content
    payload["baseline_run_id"] = resolved_baseline_run_id
    return payload

