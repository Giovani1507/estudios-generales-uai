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
      style={{ minHeight: "calc(100vh - 56px)", background: "#eef2f9" }}
    >
      {/* Background image very faint */}
      <img
        src={`${base}dashboard-bg.png`}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        style={{ opacity: 0.07 }}
      />

      {/* Card */}
      <div
        className="relative z-10 bg-white rounded-2xl overflow-hidden shadow-lg"
        style={{
          width: 380,
          maxWidth: "92vw",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        {/* Cover banner */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 140, background: "linear-gradient(135deg, #001F5F 0%, #1a3a6b 60%, #2f5aa6 100%)" }}
        >
          <img
            src={`${base}dashboard-bg.png`}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
            style={{ opacity: 0.18, mixBlendMode: "luminosity" }}
          />
          {/* UAI Logo top-right */}
          <img
            src={`${base}logo.png`}
            alt="UAI"
            className="absolute top-4 right-5 object-contain"
            style={{ height: 36, opacity: 0.85 }}
          />
        </div>

        {/* Square avatar — overlaps banner */}
        <div className="flex justify-center" style={{ marginTop: -60 }}>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="object-cover shadow-xl"
              style={{
                width: 120, height: 120,
                borderRadius: 14,
                border: "4px solid #fff",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center shadow-xl font-bold text-white"
              style={{
                width: 120, height: 120,
                borderRadius: 14,
                border: "4px solid #fff",
                fontSize: 38,
                background: "linear-gradient(135deg, #2f5aa6 0%, #001F5F 100%)",
              }}
            >
              {getInitials(displayName)}
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="flex flex-col items-center text-center px-8 pt-4 pb-8 gap-1.5">
          <p className="text-gray-400 text-sm">{greeting()},</p>
          <h1
            className="font-bold text-gray-900"
            style={{ fontSize: "1.4rem", lineHeight: 1.25 }}
          >
            {displayName}
          </h1>

          {roleLabel && (
            <span
              className="mt-1 px-4 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: "#2f5aa6" }}
            >
              {roleLabel}
            </span>
          )}

          {user?.cargo && (
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">{user.cargo}</p>
          )}

          <div className="w-12 h-px bg-gray-200 my-3" />

          <p className="text-gray-600 text-sm font-semibold">Universidad Autónoma de Ica</p>
          <p className="text-gray-400 text-xs">Período 2026-1</p>
        </div>
      </div>
    </div>
  );
}
