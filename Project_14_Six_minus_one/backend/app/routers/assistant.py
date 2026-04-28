from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter

from ..core import AssistantChatPayload
from ...services.assistant_service import (
    build_fallback_assistant_reply,
    call_claude_assistant,
    call_openai_assistant,
    is_accessibility_scope_message,
    out_of_scope_reply,
)

router = APIRouter()


@router.post("/assistant/chat")
def assistant_chat(payload: AssistantChatPayload) -> dict[str, Any]:
    if not is_accessibility_scope_message(payload.message):
        return {
            "reply": out_of_scope_reply(),
            "provider": "scope-guard",
        }

    provider = "fallback"
    reply = ""
    if os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY"):
        reply = call_claude_assistant(payload)
        provider = "claude"
    elif os.getenv("OPENAI_API_KEY"):
        reply = call_openai_assistant(payload)
        provider = "openai" if reply else "fallback"
    if not reply:
        reply = build_fallback_assistant_reply(payload)
        provider = "fallback"
    return {
        "reply": reply,
        "provider": provider,
    }

