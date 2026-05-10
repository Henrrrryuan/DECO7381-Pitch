import { logRenderContext } from "../shared/renderForensics.js";

function renderWorkspacePlaceholderMarkup() {
  const markup = "";
  logRenderContext({
    renderer: "workspaceRenderer",
    context_type: "workspace",
    issue_rule: "",
    selected: false,
    render_size: 0,
  });
  return markup;
}

export { renderWorkspacePlaceholderMarkup };

