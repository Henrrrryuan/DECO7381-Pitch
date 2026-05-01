import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import "./styles/eyeTracking.css";
import { EyeTrackingPage } from "./pages/EyeTrackingPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";

// Vite starts the React app from this entry file. It imports the existing
// shared CSS from frontend/styles.css so migrated pages keep the same visual
// language as the older static pages, then chooses the React page from the
// current route. This keeps /, /history, and /eye on the same Vite app.
const routePath = window.location.pathname;
const isEyeRoute = routePath.startsWith("/eye");
const isHistoryRoute = routePath.startsWith("/history");
const isHomeRoute = !isEyeRoute && !isHistoryRoute;
const ActivePage = routePath.startsWith("/eye")
  ? EyeTrackingPage
  : routePath.startsWith("/history")
    ? HistoryPage
    : HomePage;

// The old Home page had <body class="upload-body"> directly in index.html.
// Set that class before React renders so the dark patterned background appears
// immediately and matches the legacy upload page instead of briefly using the
// default light body background.
document.body.classList.toggle("upload-body", isHomeRoute);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActivePage />
  </React.StrictMode>,
);
