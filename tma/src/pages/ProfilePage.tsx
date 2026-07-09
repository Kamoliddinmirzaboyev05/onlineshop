import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Address } from "../api/types";
import { useI18n, type Lang } from "../i18n";
import { useAuth } from "../store/auth";

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const user = useAuth((s) => s.user);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddr, setNewAddr] = useState("");

  const load = () => api.addresses().then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => {
    load();
  }, []);

  const addAddress = async () => {
    if (!newAddr.trim()) return;
    await api.createAddress({ label: "Uy", address_line: newAddr });
    setNewAddr("");
    load();
  };

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold">{t.profile}</h1>

      <div className="card p-4">
        <p className="font-semibold">{user?.first_name ?? "—"}</p>
        <p className="text-tg-hint text-sm">{user?.phone ?? user?.username ?? ""}</p>
      </div>

      <div>
        <h2 className="font-semibold mb-2">🌐 Til / Язык</h2>
        <div className="flex gap-2">
          {(["uz", "ru"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 py-2 rounded-xl ${
                lang === l ? "bg-brand text-white" : "bg-tg-card"
              }`}
            >
              {l === "uz" ? "🇺🇿 O'zbek" : "🇷🇺 Русский"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">📍 {t.address}</h2>
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="card p-3 flex justify-between items-center">
              <span className="text-sm">{a.address_line}</span>
              <button onClick={() => api.deleteAddress(a.id).then(load)} className="text-red-500">
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder={t.address_ph}
            className="flex-1 rounded-xl bg-tg-card px-4 py-2 outline-none"
          />
          <button onClick={addAddress} className="btn-brand px-4">+</button>
        </div>
      </div>
    </div>
  );
}
