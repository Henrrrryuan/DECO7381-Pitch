import React from "react";
import { createRoot } from "react-dom/client";

import "../../frontend/styles.css";
import { HistoryPage } from "./pages/HistoryPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HistoryPage />
  </React.StrictMode>,
);
