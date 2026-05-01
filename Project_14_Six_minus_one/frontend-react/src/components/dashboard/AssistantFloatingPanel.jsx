import { useEffect, useRef, useState } from "react";

export function AssistantFloatingPanel({
  assistantIsOpen,
  assistantMessages,
  assistantIsPending,
  onAssistantOpen,
  onAssistantClose,
  onAssistantClear,
  onAssistantSubmit,
}) {
  // Floating assistant window.
  //
  // DashboardPage.jsx owns chat state and backend calls. This component keeps
  // the original assistant DOM classes, handles message input, and lets users
  // drag the window without changing the old CSS.
  const [inputValue, setInputValue] = useState("");
  const [assistantPosition, setAssistantPosition] = useState(null);
  const assistantWindowReference = useRef(null);
  const assistantDragHandleReference = useRef(null);
  const assistantMessagesReference = useRef(null);

  useEffect(() => {
    if (!assistantIsOpen) {
      return;
    }

    document.body.classList.add("assistant-floating-open");
    const assistantRectangle = assistantWindowReference.current?.getBoundingClientRect();
    if (!assistantPosition && assistantRectangle) {
      setAssistantPosition({
        left: Math.max(16, window.innerWidth - assistantRectangle.width - 28),
        top: Math.max(76, window.innerHeight - assistantRectangle.height - 28),
      });
    }

    return () => {
      document.body.classList.remove("assistant-floating-open");
    };
  }, [assistantIsOpen, assistantPosition]);

  useEffect(() => {
    const messageContainer = assistantMessagesReference.current;
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }, [assistantMessages, assistantIsPending]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || assistantIsPending) {
      return;
    }
    onAssistantSubmit(trimmedMessage);
    setInputValue("");
  };

  const handleDragStart = (event) => {
    if (event.button !== 0 || event.target.closest("button, input, textarea, a, select, option, label")) {
      return;
    }

    event.preventDefault();
    const startRectangle = assistantWindowReference.current?.getBoundingClientRect();
    if (!startRectangle) {
      return;
    }

    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    document.body.classList.add("dragging-assistant");
    assistantDragHandleReference.current?.setPointerCapture?.(event.pointerId);

    const moveAssistant = (moveEvent) => {
      const nextLeft = startRectangle.left + (moveEvent.clientX - startPointerX);
      const nextTop = startRectangle.top + (moveEvent.clientY - startPointerY);
      const maximumLeft = Math.max(16, window.innerWidth - startRectangle.width - 16);
      const maximumTop = Math.max(76, window.innerHeight - startRectangle.height - 16);
      setAssistantPosition({
        left: Math.min(Math.max(16, nextLeft), maximumLeft),
        top: Math.min(Math.max(76, nextTop), maximumTop),
      });
    };

    const stopDragging = () => {
      document.body.classList.remove("dragging-assistant");
      window.removeEventListener("pointermove", moveAssistant);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };

    window.addEventListener("pointermove", moveAssistant);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  };

  return (
    <>
      <article
        id="assistantFloatingWindow"
        className="workspace-pane suggestion-pane assistant-floating-window"
        aria-label="AI Assistant"
        hidden={!assistantIsOpen}
        ref={assistantWindowReference}
        style={assistantPosition ? {
          left: `${assistantPosition.left}px`,
          top: `${assistantPosition.top}px`,
          right: "auto",
          bottom: "auto",
        } : undefined}
      >
        <div
          id="assistantDragHandle"
          className="pane-header assistant-floating-header"
          ref={assistantDragHandleReference}
          onPointerDown={handleDragStart}
        >
          <h2>AI Assistant</h2>
          <div className="assistant-header-actions">
            <button id="clearAssistantButton" className="assistant-clear-button" type="button" onClick={onAssistantClear}>Clear</button>
            <button id="assistantMinimizeButton" className="assistant-clear-button" type="button" onClick={onAssistantClose}>Minimize</button>
          </div>
        </div>
        <div
          id="assistantMessages"
          className="assistant-messages"
          aria-live="polite"
          ref={assistantMessagesReference}
        >
          {assistantMessages.map((message, messageIndex) => (
            <article
              className={`assistant-message assistant-message-${message.role}`}
              key={`${message.role}-${messageIndex}-${message.content}`}
            >
              <p>{message.content}</p>
            </article>
          ))}
          {assistantIsPending ? (
            <article className="assistant-message assistant-message-assistant assistant-message-pending">
              <p>Thinking...</p>
            </article>
          ) : null}
        </div>
        <form id="assistantForm" className="assistant-input-area" onSubmit={handleSubmit}>
          <input
            id="assistantInput"
            className="assistant-input"
            type="text"
            placeholder="Ask how to improve this page"
            autoComplete="off"
            value={inputValue}
            disabled={assistantIsPending}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button id="assistantSendButton" className="assistant-send-button" type="submit" disabled={assistantIsPending}>
            {assistantIsPending ? "Sending..." : "Send"}
          </button>
        </form>
      </article>

      <button
        id="assistantFloatingButton"
        className="assistant-floating-button"
        type="button"
        aria-controls="assistantFloatingWindow"
        aria-expanded={assistantIsOpen}
        onClick={onAssistantOpen}
      >
        <span>AI</span>
        <strong>Assistant</strong>
      </button>
    </>
  );
}
