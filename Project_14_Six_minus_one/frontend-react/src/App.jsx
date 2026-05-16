import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoadingPage } from "./pages/LoadingPage.jsx";
import { VicramPage } from "./pages/VicramPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/vicram" element={<VicramPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
