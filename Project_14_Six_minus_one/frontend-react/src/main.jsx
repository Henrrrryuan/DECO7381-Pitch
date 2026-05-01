import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import "./styles/eyeTracking.css";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { EyeTrackingPage } from "./pages/EyeTrackingPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { LoadingPage } from "./pages/LoadingPage.jsx";

// Vite starts the React app from this entry file. It imports the existing
// shared CSS from frontend/styles.css so migrated pages keep the same visual
// language as the older static pages, then chooses the React page from the
// current route. This keeps /, /loading, /dashboard, /history, and /eye on the
// same Vite app.
const routePath = window.location.pathname;
const isEyeRoute = routePath.startsWith("/eye");
const isHistoryRoute = routePath.startsWith("/history");
const isLoadingRoute = routePath.startsWith("/loading");
const isDashboardRoute = routePath.startsWith("/dashboard");
const isHomeRoute = !isEyeRoute && !isHistoryRoute && !isLoadingRoute && !isDashboardRoute;
const ActivePage = isEyeRoute
  ? EyeTrackingPage
  : isHistoryRoute
    ? HistoryPage
    : isLoadingRoute
      ? LoadingPage
      : isDashboardRoute
        ? DashboardPage
        : HomePage;

// The old Home and Loading pages had <body class="upload-body"> directly in
// their HTML files. Set that class before React renders so the dark patterned
// background appears immediately and matches the legacy upload/loading pages.
document.body.classList.toggle("upload-body", isHomeRoute || isLoadingRoute);
document.body.classList.toggle("dashboard-body", isDashboardRoute);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActivePage />
  </React.StrictMode>,
);
