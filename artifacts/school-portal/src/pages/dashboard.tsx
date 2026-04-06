import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  CalendarDays, School, Users, FolderOpen, AlertTriangle, UserCheck, Activity,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  administrativo: "Administrativo",
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const QUICK_LINKS = [
  { label: "Horario Docente FICA", href: "/docentes/horario-fica", Icon: CalendarDays, color: "#1d4ed8" },
  { label: "Horario Docente FCS",  href: "/docentes/horario-fcs",  Icon: CalendarDays, color: "#0369a1" },
  { label: "Horario por Aula",     href: "/horarios/carrera",       Icon: School,       color: "#0f766e" },
  { label: "Lista de Docentes",    href: "/lista-docentes/fica",    Icon: UserCheck,    color: "#7c3aed" },
  { label: "Planificación",        href: "/planificacion/crear",    Icon: FolderOpen,   color: "#b45309" },
  { label: "Cruce de Horarios",    href: "/planificacion/cruce",    Icon: AlertTriangle,color: "#b91c1c" },
];

const STATS = [
  { label: "Docentes FICA",  value: "101", sub: "Ciclos 1 y 2",        color: "#1d4ed8" },
  { label: "Docentes FCS",   value: "109", sub: "Ciclos 1 y 2",        color: "#0369a1" },
  { label: "Sede FICA",      value: "3",   sub: "Locales académicos",   color: "#0f766e" },
  { label: "Sedes FCS",      value: "5",   sub: "Locales académicos",   color: "#7c3aed" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";
  const displayName = user?.fullName || user?.username || "Usuario";
  const base = import.meta.env.BASE_URL;

  return (
    <div
      className="relative flex flex-col min-h-screen overflow-hidden"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${base}dashboard-bg.png`}
          alt=""
          className="w-full h-full object-cover object-center"
          style={{ filter: "brightness(0.38)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(175deg, rgba(0,20,70,0.55) 0%, rgba(0,10,40,0.45) 40%, rgba(0,5,20,0.70) 100%)",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div
        className="relative z-10 flex flex-col flex-1"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Top bar — logo + institution */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2">
          <div className="flex items-center gap-3">
            <img
              src={`${base}escudo.png`}
              alt="UAI"
              className="w-10 h-10 object-contain"
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }}
            />
            <div className="leading-tight">
              <p className="text-white/90 text-xs font-semibold tracking-widest uppercase">
                Universidad Autónoma de Ica
              </p>
              <p className="text-white/55 text-[11px] tracking-wide">
                Portal Académico · 2026-1
              </p>
            </div>
          </div>
          <span
            className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/20 text-white/70 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            Período 2026-1
          </span>
        </div>

        {/* ── Hero greeting ── */}
        <div className="flex flex-col items-center justify-center flex-1 px-8 py-6 text-center">
          {/* Avatar */}
          <div className="mb-5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="rounded-full object-cover border-[3px] shadow-2xl"
                style={{ width: 96, height: 96, borderColor: "rgba(255,255,255,0.4)" }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center shadow-2xl font-bold text-white border-[3px]"
                style={{
                  width: 96, height: 96, fontSize: 32,
                  background: "linear-gradient(135deg, #2f5aa6 0%, #1a3a6b 100%)",
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <p className="text-white/65 text-base font-medium mb-1 tracking-wide">
            {greeting()},
          </p>
          <h1
            className="font-bold text-white mb-3 leading-tight"
            style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
          >
            {displayName}
          </h1>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span
              className="px-4 py-1 rounded-full text-sm font-semibold text-white"
              style={{ background: "rgba(47,90,166,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              {roleLabel}
            </span>
            {user?.cargo && (
              <span
                className="px-3 py-1 rounded-full text-xs font-medium text-white/80"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {user.cargo}
              </span>
            )}
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-4 py-3 text-center"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <p className="text-2xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-white/80 text-xs font-semibold mt-0.5">{s.label}</p>
                <p className="text-white/45 text-[10px] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick access ── */}
        <div
          className="px-6 pb-8"
          style={{
            background: "linear-gradient(to top, rgba(0,5,25,0.70) 0%, transparent 100%)",
          }}
        >
          <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase text-center mb-3">
            Acceso rápido
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 max-w-3xl mx-auto">
            {QUICK_LINKS.map(({ label, href, Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 text-center group transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                  style={{ background: color + "cc" }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/75 text-[10px] font-medium leading-tight group-hover:text-white transition-colors">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
