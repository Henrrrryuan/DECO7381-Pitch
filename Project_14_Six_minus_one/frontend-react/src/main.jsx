import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import "./styles/eyeTracking.css";
import { EyeTrackingPage } from "./pages/EyeTrackingPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";

// Vite starts the React app from this entry file. It imports the existing
// shared CSS from frontend/styles.css so the migrated History page keeps the
// same visual language as the older static pages, then chooses the React page
// from the current route. This keeps /history and /eye on the same Vite app.
const routePath = window.location.pathname;
const ActivePage = routePath.startsWith("/eye") ? EyeTrackingPage : HistoryPage;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActivePage />
  </React.StrictMode>,
);
