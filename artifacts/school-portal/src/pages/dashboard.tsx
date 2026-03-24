import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  administrativo: "Administrativo",
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

function greeting(): string {
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

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";
  const displayName = user?.fullName || user?.username || "Usuario";

  return (
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: "calc(100vh - 60px)",
        background: "linear-gradient(160deg, #ffffff 0%, #e8f0fb 55%, #c9d9f5 100%)",
      }}
    >
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(28px)",
          transition: "opacity 0.65s ease, transform 0.65s ease",
        }}
        className="flex flex-col items-center gap-6 text-center px-8"
      >
        {/* Avatar */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="rounded-full object-cover border-4 border-white shadow-lg"
            style={{ width: 110, height: 110 }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center border-4 border-white shadow-lg text-white font-bold"
            style={{
              width: 110,
              height: 110,
              fontSize: 36,
              background: "linear-gradient(135deg, #2f5aa6 0%, #1a3a6b 100%)",
            }}
          >
            {getInitials(displayName)}
          </div>
        )}

        {/* Greeting */}
        <div className="flex flex-col gap-1">
          <p
            className="font-medium tracking-wide"
            style={{ color: "#6b7280", fontSize: "clamp(0.9rem, 2vw, 1.05rem)" }}
          >
            {greeting()},
          </p>
          <h1
            className="font-bold"
            style={{
              color: "#1a3a6b",
              fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)",
              lineHeight: 1.15,
            }}
          >
            {displayName}
          </h1>
          {roleLabel && (
            <span
              className="mt-1 inline-block px-4 py-1 rounded-full text-sm font-semibold"
              style={{ background: "#2f5aa6", color: "#fff" }}
            >
              {roleLabel}
            </span>
          )}
          {user?.cargo && (
            <p
              className="font-medium"
              style={{ color: "#4b5563", fontSize: "clamp(0.8rem, 1.6vw, 0.95rem)", maxWidth: 380 }}
            >
              {user.cargo}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="w-20 h-px rounded-full" style={{ background: "#c9d9f5" }} />

        {/* Institution */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="font-semibold" style={{ color: "#374151", fontSize: "0.95rem" }}>
            Universidad Autónoma de Ica
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.82rem" }}>
            Estudios Generales · Período 2026-1
          </p>
        </div>
      </div>
    </div>
  );
}
