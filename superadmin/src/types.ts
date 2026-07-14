// Platforma super-admin hisobi (/platform/auth/me).
export interface SuperAdmin {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

export type StatsPeriod = "today" | "week" | "month" | "all";

// Bitta tadbirkor bo'yicha statistika qatori (dashboard).
export interface BusinessBreakdown {
  business_id: number;
  name: string;
  stores: number;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
}

// Platforma umumiy statistikasi (/platform/stats).
export interface PlatformStats {
  businesses_total: number;
  stores_total: number;
  customers_total: number;
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  businesses: BusinessBreakdown[];
}

// Tadbirkor ro'yxati qatori (/platform/businesses).
export interface BusinessRow {
  id: number;
  name: string;
  phone?: string | null;
  username: string;
  is_active: boolean;
  created_at: string;
  stores_count: number;
}

// Do'kon ro'yxati qatori (/platform/stores).
export interface StoreRow {
  id: number;
  name: string;
  address?: string | null;
  is_active: boolean;
  is_open: boolean;
  business_id: number;
  business_name: string;
  created_at: string;
}

// Bot foydalanuvchisi / mijoz (/platform/users).
export interface UserRow {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  is_blocked: boolean;
  created_at: string;
}

// E'lon (announcement).
export interface Announcement {
  id: number;
  text: string;
  image_url?: string | null;
  button_text: string;
  status: "pending" | "sending" | "sent";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string | null;
}
