import { useEffect } from "react";
import { createAccessibilityWidget } from "../lib/accessibility-widget.js";

export function AccessibilityWidgetMount() {
  useEffect(() => {
    createAccessibilityWidget();
  }, []);
  return null;
}
