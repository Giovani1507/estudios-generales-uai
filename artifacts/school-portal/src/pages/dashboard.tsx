import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  administrativo: "Administrativo",
};

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join("");
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const roleLabel   = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";
  const displayName = user?.fullName || user?.username || "Usuario";
  const base        = import.meta.env.BASE_URL;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ minHeight: "calc(100vh - 56px)", background: "#f8faff" }}
    >
      {/* Subtle background image */}
      <img
        src={`${base}dashboard-bg.png`}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        style={{ opacity: 0.06 }}
      />

      {/* Card */}
      <div
        className="relative z-10 flex flex-col items-center text-center gap-6 bg-white rounded-3xl shadow-sm border border-gray-100 px-14 py-12"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
          maxWidth: 440,
          width: "90%",
        }}
      >
        {/* Logo */}
        <img
          src={`${base}logo.png`}
          alt="UAI"
          className="object-contain"
          style={{ width: 160, height: 64 }}
        />

        <div className="w-10 h-px bg-gray-200" />

        {/* Avatar */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="rounded-full object-cover shadow-md"
            style={{ width: 80, height: 80, border: "3px solid #e8f0fb" }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center shadow-md font-bold text-white"
            style={{
              width: 80, height: 80, fontSize: 26,
              background: "linear-gradient(135deg, #2f5aa6 0%, #1a3a6b 100%)",
              border: "3px solid #e8f0fb",
            }}
          >
            {getInitials(displayName)}
          </div>
        )}

        {/* Greeting */}
        <div className="flex flex-col gap-1.5">
          <p className="text-gray-400 text-sm">{greeting()},</p>
          <h1 className="text-gray-800 font-bold" style={{ fontSize: "1.45rem", lineHeight: 1.2 }}>
            {displayName}
          </h1>
          {roleLabel && (
            <span
              className="inline-block self-center mt-1 px-4 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: "#2f5aa6" }}
            >
              {roleLabel}
            </span>
          )}
          {user?.cargo && (
            <p className="text-gray-400 text-xs mt-1">{user.cargo}</p>
          )}
        </div>

        <div className="w-10 h-px bg-gray-200" />

        {/* Footer */}
        <div className="flex flex-col gap-0.5">
          <p className="text-gray-500 text-sm font-medium">Universidad Autónoma de Ica</p>
          <p className="text-gray-400 text-xs">Período 2026-1</p>
        </div>
      </div>
    </div>
  );
}
