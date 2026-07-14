import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { hasToken, setToken } from "./api";
import { ConfirmHost } from "./components/Confirm";
import Layout from "./components/Layout";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import BusinessesPage from "./pages/BusinessesPage";
import CustomersPage from "./pages/CustomersPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import StoresPage from "./pages/StoresPage";
import { useAuth } from "./store";

function Protected({ children }: { children: React.ReactNode }) {
  const { admin, loadMe } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasToken()) {
      setChecked(true);
      return;
    }
    loadMe().finally(() => setChecked(true));
  }, [loadMe]);

  if (!checked) return <div className="p-10 text-gray-400">…</div>;

  // Token bor-u, loadMe muvaffaqiyatsiz bo'lsa (admin null qoldi) — token
  // eskirgan/yaroqsiz. Tozalab, login sahifasiga qaytaramiz.
  if (!admin) {
    if (hasToken()) setToken(null);
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { borderRadius: "12px" } }}
      />
      <ConfirmHost />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/businesses" element={<Protected><BusinessesPage /></Protected>} />
        <Route path="/stores" element={<Protected><StoresPage /></Protected>} />
        <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
        <Route path="/announcements" element={<Protected><AnnouncementsPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
