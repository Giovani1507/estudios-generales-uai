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
      className="flex items-center justify-center"
      style={{
        minHeight: "calc(100vh - 56px)",
        background: "linear-gradient(145deg, #c8d9f5 0%, #dde8fa 30%, #f0f5fd 60%, #ffffff 100%)",
      }}
    >
      <div
        className="flex flex-col items-center text-center px-8"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.65s ease, transform 0.65s ease",
          maxWidth: 560,
          width: "100%",
        }}
      >
        {/* Avatar circular */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="rounded-full object-cover mb-5 shadow-md"
            style={{ width: 100, height: 100, border: "4px solid #fff" }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center mb-5 shadow-md font-bold text-white"
            style={{
              width: 100, height: 100, fontSize: 32,
              border: "4px solid #fff",
              background: "linear-gradient(135deg, #2f5aa6 0%, #1a3a6b 100%)",
            }}
          >
            {getInitials(displayName)}
          </div>
        )}

        {/* Greeting */}
        <p className="text-gray-400 text-base mb-1">{greeting()},</p>

        {/* Name */}
        <h1
          className="font-bold text-gray-900 mb-3 leading-tight"
          style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.1rem)" }}
        >
          {displayName}
        </h1>

        {/* Role badge — wide pill */}
        {roleLabel && (
          <span
            className="inline-block px-10 py-2 rounded-full text-sm font-semibold text-white mb-2"
            style={{ background: "#2f5aa6", minWidth: 180 }}
          >
            {roleLabel}
          </span>
        )}

        {/* Cargo */}
        {user?.cargo && (
          <p className="text-gray-500 text-sm mt-1">{user.cargo}</p>
        )}

        {/* Divider */}
        <div className="w-32 h-px bg-gray-300 my-6" />

        {/* Institution */}
        <p className="text-gray-800 font-semibold text-base">Universidad Autónoma de Ica</p>
        <p className="text-gray-400 text-sm mt-0.5">Estudios Generales · Período 2026-1</p>
      </div>
    </div>
  );
}
