import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import { HistoryPage } from "./pages/HistoryPage.jsx";

// Vite starts the React app from this entry file. It imports the existing
// shared CSS from frontend/styles.css so the migrated History page keeps the
// same visual language as the older static pages, then mounts HistoryPage into
// the root element defined in frontend-react/index.html.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HistoryPage />
  </React.StrictMode>,
);
