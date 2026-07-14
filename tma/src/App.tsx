import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Splash from "./components/Splash";
import CartPage from "./pages/CartPage";
import CategoryPage from "./pages/CategoryPage";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import LocationPickerPage from "./pages/LocationPickerPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import { useAuth } from "./store/auth";

export default function App() {
  const { ready, login } = useAuth();

  useEffect(() => {
    login();
  }, [login]);

  return (
    <>
      <AnimatePresence>{!ready && <Splash />}</AnimatePresence>
      {ready && (
        <div className="min-h-full pb-20">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:id" element={<CategoryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/location" element={<LocationPickerPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </div>
      )}
    </>
  );
}
