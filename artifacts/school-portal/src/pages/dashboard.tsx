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
      {/* Page background */}
      <img
        src={`${base}dashboard-bg.png`}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ opacity: 0.06 }}
      />

      {/* Card */}
      <div
        className="relative z-10 bg-white rounded-2xl shadow-md overflow-hidden"
        style={{
          width: 480,
          maxWidth: "92vw",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        {/* Header — navy gradient with avatar inside */}
        <div
          className="relative flex flex-col items-center justify-end pb-8 pt-10"
          style={{
            background: "linear-gradient(160deg, #001F5F 0%, #1d3d7a 60%, #2f5aa6 100%)",
            minHeight: 220,
          }}
        >
          {/* UAI logo top-left */}
          <img
            src={`${base}logo.png`}
            alt="UAI"
            className="absolute top-5 left-6 object-contain"
            style={{ height: 32, opacity: 0.80, filter: "brightness(0) invert(1)" }}
          />

          {/* Period badge top-right */}
          <span
            className="absolute top-5 right-5 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.13)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            2026-1
          </span>

          {/* Square avatar — inside header */}
          <div style={{ marginBottom: 0 }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="object-cover shadow-2xl"
                style={{
                  width: 130, height: 130,
                  borderRadius: 16,
                  border: "3px solid rgba(255,255,255,0.35)",
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center font-extrabold text-white shadow-2xl"
                style={{
                  width: 130, height: 130,
                  borderRadius: 16,
                  fontSize: 46,
                  background: "rgba(255,255,255,0.15)",
                  border: "3px solid rgba(255,255,255,0.30)",
                  backdropFilter: "blur(6px)",
                  letterSpacing: "-1px",
                }}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-10 pt-6 pb-8 gap-1.5">
          <p className="text-gray-400 text-sm">{greeting()},</p>
          <h1
            className="font-bold text-gray-900 leading-snug"
            style={{ fontSize: "1.5rem" }}
          >
            {displayName}
          </h1>

          {roleLabel && (
            <span
              className="mt-2 px-5 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ background: "#2f5aa6" }}
            >
              {roleLabel}
            </span>
          )}

          {user?.cargo && (
            <p className="text-gray-400 text-xs mt-1 leading-snug max-w-xs">{user.cargo}</p>
          )}

          <div className="w-12 h-px bg-gray-200 my-4" />

          <p className="text-gray-700 text-sm font-semibold">Universidad Autónoma de Ica</p>
          <p className="text-gray-400 text-xs">Período 2026-1</p>
        </div>
      </div>
    </div>
  );
}
