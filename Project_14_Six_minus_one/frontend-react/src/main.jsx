import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import { HistoryPage } from "./pages/HistoryPage.jsx";

// Vite starts from this file. It loads the shared CSS from the existing
// frontend and mounts the React History page into frontend-react/index.html.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HistoryPage />
  </React.StrictMode>,
);
