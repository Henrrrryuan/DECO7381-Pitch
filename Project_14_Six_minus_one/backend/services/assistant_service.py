from __future__ import annotations

import json
import os
import ssl
from importlib.util import find_spec
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from ..app.core import AssistantChatPayload


def format_analysis_context(context: dict[str, Any] | None) -> str:
    if not context:
        return "No analysis context was provided."

    lines = [
        f"Source: {context.get('source_name') or 'Uploaded file'}",
        f"Overall score: {context.get('overall_score', 'n/a')}",
        f"Lowest dimension score: {context.get('min_dimension_score', 'n/a')}",
    ]

    for dimension in context.get("dimensions", []):
        issue_count = len(dimension.get("issues", []))
        lines.append(
            f"- {dimension.get('dimension', 'Unknown dimension')}: score {dimension.get('score', 'n/a')}, issues {issue_count}"
        )
        for issue in dimension.get("issues", [])[:2]:
            lines.append(
                "  "
                + f"* {issue.get('rule_id', 'rule')}: {issue.get('description', '')}"
            )

    return "\n".join(lines)


def is_accessibility_scope_message(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return True
    allow_keywords = [
        "website",
        "web",
        "page",
        "site",
        "dashboard",
        "design",
        "layout",
        "content",
        "improve",
        "improvement",
        "suggestion",
        "optimize",
        "optimi",
        "cognitive",
        "accessibility",
        "readability",
        "visual clutter",
        "interaction",
        "distraction",
        "consistency",
        "dyslexia",
        "adhd",
        "ux",
        "ui",
        "网站",
        "网页",
        "页面",
        "界面",
        "仪表盘",
        "内容",
        "改进",
        "优化",
        "建议",
        "认知",
        "可访问",
        "可及",
        "可读",
        "阅读",
        "注意力",
        "交互",
        "一致性",
        "信息过载",
        "无障碍",
    ]
    if any(keyword in text for keyword in allow_keywords):
        return True

    deny_keywords = [
        "weather",
        "temperature",
        "forecast",
        "rain",
        "股票",
        "股价",
        "汇率",
        "彩票",
        "新闻",
        "体育",
        "八卦",
        "天气",
        "气温",
        "预报",
    ]
    if any(keyword in text for keyword in deny_keywords):
        return False

    if "=" in text and any(ch.isdigit() for ch in text):
        return False

    return True


def out_of_scope_reply() -> str:
    return (
        "I can only answer cognitive accessibility and UI readability questions in this assistant. "
        "Please ask about cognitive load, readability, visual clutter, interaction distraction, consistency, "
        "or how to improve your page for users with cognitive needs."
    )


def build_fallback_assistant_reply(payload: AssistantChatPayload) -> str:
    context = payload.analysis_context or {}
    dimensions = context.get("dimensions", [])
    risky_dimensions = [dimension for dimension in dimensions if dimension.get("issues")]

    opening = (
        "AI assistant is running in local guidance mode based on the current analysis context."
    )
    if not risky_dimensions:
        return (
            f"{opening}\n\n"
            "The current page does not trigger any of the active heuristic rules. "
            "You can ask me to explain a dimension in more detail or upload a denser page for richer feedback."
        )

    first_dimension = risky_dimensions[0]
    bullets = []
    for issue in first_dimension.get("issues", [])[:3]:
        bullets.append(
            f"- {issue.get('rule_id', 'Issue')}: {issue.get('suggestion', 'Review this issue and simplify the interaction.')}"
        )

    return (
        f"{opening}\n\n"
        f"Based on your question: \"{payload.message}\", the most urgent area is "
        f"{first_dimension.get('dimension', 'the current dimension')} "
        f"(score {first_dimension.get('score', 'n/a')}).\n\n"
        "Recommended first fixes:\n"
        + "\n".join(bullets)
    )


def call_openai_assistant(payload: AssistantChatPayload) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return ""

    endpoint = os.getenv("OPENAI_BASE_URL", "https://api.openai.com").rstrip("/") + "/v1/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    system_prompt = (
        "You are an AI accessibility assistant inside CogniLens. "
        "Answer briefly and concretely for a developer. Focus on cognitive accessibility, readability, "
        "visual clutter, interaction distraction, and consistency. Prioritize the most important fix first. "
        "If the user asks for multiple points, cover every point in order (do not omit items). "
        "Keep each point short and avoid markdown tables."
    )
    user_prompt = (
        f"User question:\n{payload.message}\n\n"
        "Analysis context:\n"
        f"{format_analysis_context(payload.analysis_context)}"
    )
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    reply_parts: list[str] = []

    continue_prompt = (
        "Continue from where you stopped and finish all remaining points. "
        "Do not repeat earlier text. Output continuation only. "
        "继续从上文中断处往下写，直到完成全部要求；不要重复前文，只输出续写内容。"
    )

    for _ in range(6):
        request_body = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 500,
        }
        request = urllib_request.Request(
            endpoint,
            data=json.dumps(request_body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=45) as response:
                payload_json = json.loads(response.read().decode("utf-8"))
        except (urllib_error.HTTPError, urllib_error.URLError, TimeoutError):
            return "\n".join(reply_parts).strip() if reply_parts else ""

        choices = payload_json.get("choices", [])
        if not choices:
            break

        choice = choices[0]
        message = choice.get("message", {})
        content = message.get("content", "")
        if isinstance(content, str) and content.strip():
            reply_parts.append(content.strip())
        else:
            break

        finish_reason = str(choice.get("finish_reason") or "")
        if finish_reason != "length":
            break

        messages.extend(
            [
                {"role": "assistant", "content": reply_parts[-1]},
                {"role": "user", "content": continue_prompt},
            ]
        )

    return "\n".join(part for part in reply_parts if part).strip()


def call_claude_assistant(payload: AssistantChatPayload) -> str:
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not auth_token:
        return ""

    endpoint = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/") + "/v1/messages"
    preferred_models = [
        os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
    ]
    system_prompt = (
        "You are an AI accessibility assistant inside CogniLens. "
        "Answer briefly and concretely for a developer. Focus on cognitive accessibility, readability, "
        "visual clutter, interaction distraction, and consistency. Prioritize the most important fix first. "
        "If the user asks for multiple points, cover every point in order (do not omit items). "
        "Keep each point short and avoid markdown tables."
    )
    user_prompt = (
        f"User question:\n{payload.message}\n\n"
        "Analysis context:\n"
        f"{format_analysis_context(payload.analysis_context)}"
    )
    headers = {
        "Content-Type": "application/json",
        "x-api-key": auth_token,
        "Authorization": f"Bearer {auth_token}",
        "anthropic-version": "2023-06-01",
    }
    ssl_context = None
    if endpoint.startswith("https://"):
        if find_spec("certifi") is not None:
            import certifi

            ssl_context = ssl.create_default_context(cafile=certifi.where())
        elif "api.anthropic.com" not in endpoint:
            ssl_context = ssl._create_unverified_context()

    opener = None
    if ssl_context is not None:
        opener = urllib_request.build_opener(urllib_request.HTTPSHandler(context=ssl_context))

    for model in dict.fromkeys(preferred_models):
        messages = [{"role": "user", "content": user_prompt}]
        reply_parts: list[str] = []

        continue_prompt = (
            "Continue from where you stopped and finish all remaining points. "
            "Do not repeat earlier text. Output continuation only. "
            "继续从上文中断处往下写，直到完成全部要求；不要重复前文，只输出续写内容。"
        )

        for _ in range(6):
            request_body = {
                "model": model,
                "max_tokens": 500,
                "system": system_prompt,
                "messages": messages,
            }
            request = urllib_request.Request(
                endpoint,
                data=json.dumps(request_body).encode("utf-8"),
                headers=headers,
                method="POST",
            )

            try:
                open_fn = opener.open if opener is not None else urllib_request.urlopen
                with open_fn(request, timeout=45) as response:
                    payload_json = json.loads(response.read().decode("utf-8"))
            except urllib_error.HTTPError as exc:
                error_body = exc.read().decode("utf-8", errors="ignore")
                if "model_not_found" in error_body:
                    reply_parts = []
                    break
                return "\n".join(reply_parts).strip() if reply_parts else ""
            except (urllib_error.URLError, TimeoutError):
                break

            content = payload_json.get("content", [])
            text_parts = [
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            reply_chunk = "\n".join(part.strip() for part in text_parts if part.strip())
            if not reply_chunk:
                break
            reply_parts.append(reply_chunk)

            stop_reason = str(payload_json.get("stop_reason") or "")
            if stop_reason != "max_tokens":
                break

            messages.extend(
                [
                    {"role": "assistant", "content": reply_chunk},
                    {"role": "user", "content": continue_prompt},
                ]
            )

        combined = "\n".join(part for part in reply_parts if part).strip()
        if combined:
            return combined

    return ""

