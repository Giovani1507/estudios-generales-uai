import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  CalendarDays, School, FolderOpen, AlertTriangle,
  UserCheck, Users, Clock,
} from "lucide-react";

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

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return now;
}

const STATS = [
  { label: "Docentes FICA",    value: "101", desc: "Ciclos 1 y 2",       accent: "#2563eb" },
  { label: "Docentes FCS",     value: "109", desc: "Ciclos 1 y 2",       accent: "#0891b2" },
  { label: "Sedes FICA",       value: "3",   desc: "Locales activos",    accent: "#059669" },
  { label: "Sedes FCS",        value: "5",   desc: "Locales activos",    accent: "#7c3aed" },
];

const LINKS = [
  { label: "Horario Docente",  sub: "FICA",            href: "/docentes/horario-fica", Icon: CalendarDays, bg: "#dbeafe", fg: "#1d4ed8" },
  { label: "Horario Docente",  sub: "FCS",             href: "/docentes/horario-fcs",  Icon: CalendarDays, bg: "#cffafe", fg: "#0e7490" },
  { label: "Horario por Aula", sub: "FICA · FCS",      href: "/horarios/carrera",      Icon: School,       bg: "#d1fae5", fg: "#047857" },
  { label: "Lista Docentes",   sub: "FICA · FCS",      href: "/lista-docentes/fica",   Icon: UserCheck,    bg: "#ede9fe", fg: "#6d28d9" },
  { label: "Planificación",    sub: "Crear · Cruce",   href: "/planificacion/crear",   Icon: FolderOpen,   bg: "#fef3c7", fg: "#b45309" },
  { label: "Cruce Horarios",   sub: "Conflictos",      href: "/planificacion/cruce",   Icon: AlertTriangle,bg: "#fee2e2", fg: "#b91c1c" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const now = useNow();

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const roleLabel   = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";
  const displayName = user?.fullName || user?.username || "Usuario";
  const base        = import.meta.env.BASE_URL;

  const dateStr = now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="flex"
      style={{
        minHeight: "calc(100vh - 56px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(14px)",
        transition: "opacity 0.55s ease, transform 0.55s ease",
      }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col overflow-hidden shrink-0"
        style={{ width: "340px", background: "#001F5F" }}
      >
        {/* Campus photo overlay */}
        <img
          src={`${base}dashboard-bg.png`}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          style={{ opacity: 0.12, mixBlendMode: "luminosity" }}
        />

        <div className="relative z-10 flex flex-col h-full px-7 py-8">
          {/* UAI brand */}
          <div className="flex items-center gap-3 mb-auto">
            <img
              src={`${base}escudo.png`}
              alt="UAI"
              className="w-9 h-9 object-contain shrink-0"
            />
            <div className="leading-tight">
              <p className="text-white font-semibold text-xs tracking-wider uppercase">Universidad Autónoma</p>
              <p className="text-white/50 text-[10px] tracking-widest uppercase">de Ica</p>
            </div>
          </div>

          {/* User card */}
          <div className="flex flex-col items-center text-center py-10">
            {/* Avatar */}
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="rounded-full object-cover mb-5 shadow-xl"
                style={{ width: 88, height: 88, border: "3px solid rgba(255,255,255,0.25)" }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center mb-5 shadow-xl font-bold text-white"
                style={{
                  width: 88, height: 88, fontSize: 28,
                  border: "3px solid rgba(255,255,255,0.20)",
                  background: "linear-gradient(135deg, #3b6cc7 0%, #1a3a6b 100%)",
                }}
              >
                {getInitials(displayName)}
              </div>
            )}

            <p className="text-white/55 text-sm mb-1">{greeting()},</p>
            <h2
              className="text-white font-bold leading-tight mb-3"
              style={{ fontSize: "clamp(1.1rem, 2vw, 1.35rem)" }}
            >
              {displayName}
            </h2>

            <span
              className="px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              {roleLabel}
            </span>

            {user?.cargo && (
              <p className="text-white/45 text-xs mt-3 leading-snug max-w-[220px]">{user.cargo}</p>
            )}
          </div>

          {/* Date / time */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-2.5"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <Clock className="w-4 h-4 text-white/40 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold leading-none">{timeStr}</p>
              <p className="text-white/45 text-[10px] mt-0.5 capitalize">{dateStr}</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span
              className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
              style={{ color: "#7fa8ff", background: "rgba(127,168,255,0.12)" }}
            >
              Período 2026-1
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-auto px-8 py-8 gap-7"
        style={{ background: "#f4f6fb" }}
      >
        {/* Section title */}
        <div>
          <h1 className="text-xl font-bold text-[#001F5F]">Panel de Control</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planificación Académica 2026-1 · UAI</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div
              key={s.label}
              className="bg-white rounded-2xl px-5 py-5 shadow-sm border border-gray-100 flex flex-col gap-1"
            >
              <div
                className="w-8 h-1 rounded-full mb-2"
                style={{ background: s.accent }}
              />
              <p className="text-3xl font-extrabold leading-none" style={{ color: s.accent }}>
                {s.value}
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Acceso rápido</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {LINKS.map(({ label, sub, href, Icon, bg, fg }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4 px-5 py-4"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={{ background: bg }}
              >
                <Icon className="w-5 h-5" style={{ color: fg }} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight group-hover:text-[#001F5F] transition-colors">
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 text-center">
          <p className="text-xs text-gray-300">
            Universidad Autónoma de Ica · Sistema de Gestión Académica © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
