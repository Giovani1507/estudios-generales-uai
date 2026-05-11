import React, { ReactNode, useMemo, useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Calendar as CalendarIcon,
  BookOpen,
  BellRing,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  Bell,
  FolderOpen,
  ChevronDown,
  CalendarDays,
  School,
  AlertTriangle,
  UserCheck,
  Activity,
  GraduationCap,
  LayoutGrid,
  Clock,
  Map,
  DatabaseZap,
  FileEdit,
  ShieldAlert,
  UserX,
  FileSpreadsheet,
  RefreshCw,
  Route,
  Eye,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserRole = "administrador" | "coordinador" | "administrativo" | "docente";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const menuItems: MenuItem[] = [
  {
    title: "Inicio",
    url: "/",
    icon: LayoutDashboard,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Horario por Semana",
    url: "/horarios/semana",
    icon: CalendarDays,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Usuarios",
    url: "/usuarios",
    icon: Users,
    roles: ["administrador"],
  },
  {
    title: "Registro de Actividad",
    url: "/actividad",
    icon: Activity,
    roles: ["administrador"],
  },
  {
    title: "Justificación de Falta",
    url: "/justificacion-falta",
    icon: ClipboardList,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Nómina",
    url: "/nomina",
    icon: FileSpreadsheet,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Soporte Justificación",
    url: "/soporte-justificacion",
    icon: ShieldCheck,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Seguridad",
    url: "/seguridad",
    icon: ShieldAlert,
    roles: ["administrador"],
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    roles: ["administrador", "coordinador"],
  },
];

function getPageTitle(pathname: string) {
  if (pathname === "/estudiantes/sin-matricula") return "Estudiantes sin Matrícula";
  if (pathname === "/estudiantes/sin-vacante")   return "Estudiantes sin Vacante";
  if (pathname === "/estudiantes/delegados")     return "Delegados";
  if (pathname === "/horarios/semana")           return "Horario por Semana";
  if (pathname === "/problemas-estudiantes")     return "Reportes de Problemas";
  if (pathname === "/supervision/ruta")          return "Ruta de Supervisión";
  const match = menuItems.find((item) => item.url === pathname);
  if (match) return match.title;
  if (pathname === "/login") return "Inicio de sesión";
  return "Portal Académico";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = `${import.meta.env.BASE_URL}login`;
      },
    },
  });

  const [planOpen, setPlanOpen] = useState(
    location.startsWith("/planificacion") ||
    location.startsWith("/docentes") ||
    (location.startsWith("/horarios") && location !== "/horarios/seccion")
  );
  const [listaOpen, setListaOpen] = useState(
    location.startsWith("/lista-docentes")
  );
  const [estudiantesOpen, setEstudiantesOpen] = useState(
    location.startsWith("/estudiantes")
  );
  const [asistenciaOpen, setAsistenciaOpen] = useState(
    location.startsWith("/planillas-asistencia") ||
    location.startsWith("/reporte-asistencia") ||
    location.startsWith("/resultados-planillas") ||
    location.startsWith("/docentes-sin-asistencias")
  );
  const [supervisionOpen, setSupervisionOpen] = useState(
    location.startsWith("/supervision")
  );
  const [gridOpen, setGridOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [clockOpen, setClockOpen] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // Peru = UTC-5 (no DST). Use Etc/GMT+5 for guaranteed accuracy.
  const TZ = "Etc/GMT+5";
  const timeStr = now.toLocaleTimeString("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("es-PE", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" });
  const peruHour = Number(now.toLocaleTimeString("es-PE", { timeZone: TZ, hour: "2-digit", hour12: false }));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clockRef.current && !clockRef.current.contains(e.target as Node)) {
        setClockOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setGridOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredMenu = useMemo(() => {
    if (!user?.role) return [];
    return menuItems.filter((item) =>
      item.roles.includes(user.role as UserRole),
    );
  }, [user?.role]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            Cargando portal académico...
          </p>
        </div>
      </div>
    );
  }

  const subItems = [
    {
      href: "/docentes/horario-fica",
      label: "Horario Docente FICA",
      Icon: CalendarDays,
    },
    {
      href: "/docentes/horario-fcs",
      label: "Horario Docente FCS",
      Icon: CalendarDays,
    },
    {
      href: "/horarios/carrera",
      label: "Horario por Aula",
      Icon: School,
    },
  ];

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <div className="flex min-h-screen w-full bg-background/50">
        {/* ── Blue institutional sidebar ── */}
        <Sidebar variant="sidebar" className="border-r-0">
          <SidebarContent className="flex flex-col bg-sidebar">
            {/* Logo */}
            <div className="px-4 py-5 flex items-center justify-center border-b border-white/15">
              <img
                src={`${import.meta.env.BASE_URL}logo-sidebar.png`}
                alt="Universidad Autónoma de Ica"
                className="object-contain w-full"
                style={{ maxWidth: "200px", maxHeight: "72px" }}
              />
            </div>

            {/* Menu */}
            <SidebarGroup className="px-0 py-2 flex-1">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  {filteredMenu.map((item, idx) => {
                    const isActive = location === item.url;

                    return (
                      <React.Fragment key={item.title}>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`
                              rounded-none border-b border-white/10 h-11 px-4
                              transition-colors duration-100
                              ${
                                isActive
                                  ? "bg-white/20 text-white font-semibold"
                                  : "text-white/90 hover:bg-white/10 hover:text-white"
                              }
                            `}
                          >
                            <Link
                              href={item.url}
                              className="flex items-center gap-3"
                            >
                              <item.icon className="w-4 h-4 shrink-0 text-white/80" />
                              <span className="text-sm flex-1 text-left">
                                {item.title}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* Planificación submenu after Inicio */}
                        {idx === 0 && (
                          <SidebarMenuItem>
                            <div className="border-b border-white/10">
                              <button
                                onClick={() => setPlanOpen((o) => !o)}
                                className="w-full flex items-center gap-3 px-4 h-11 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <FolderOpen className="w-4 h-4 shrink-0 text-white/80" />
                                <span className="text-sm flex-1 text-left">Docentes</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${planOpen ? "rotate-180" : ""}`}
                                />
                              </button>

                              {planOpen && (
                                <div className="bg-black/15">
                                  {subItems.map(({ href, label, Icon }) => (
                                    <Link
                                      key={href}
                                      href={href}
                                      className={`flex items-center gap-3 pl-10 pr-4 h-10 text-sm transition-colors border-t border-white/10 ${
                                        location === href
                                          ? "bg-white/20 text-white font-semibold"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5 shrink-0 text-white/70" />
                                      <span className="flex-1">{label}</span>
                                      <ChevronRight className="w-3 h-3 text-white/40" />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SidebarMenuItem>
                        )}

                        {/* Estudiantes submenu after Horario por Carrera */}
                        {idx === 2 && (
                          <SidebarMenuItem>
                            <div className="border-b border-white/10">
                              <button
                                onClick={() => setEstudiantesOpen((o) => !o)}
                                className="w-full flex items-center gap-3 px-4 h-11 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <Users className="w-4 h-4 shrink-0 text-white/80" />
                                <span className="text-sm flex-1 text-left">Estudiantes</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${estudiantesOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                              {estudiantesOpen && (
                                <div className="bg-black/15">
                                  {[
                                    { href: "/reporte-estudiantes",   label: "Reporte de Estudiantes", Icon: ClipboardList },
                                    { href: "/mapeo-estudiantes",     label: "Mapeo de Estudiantes",   Icon: Map },
                                    { href: "/problemas-estudiantes", label: "Reporte de Problemas",   Icon: AlertTriangle },
                                    { href: "/estudiantes/delegados", label: "Delegados",              Icon: Users },
                                  ].map(({ href, label, Icon }) => (
                                    <Link
                                      key={href}
                                      href={href}
                                      className={`flex items-center gap-3 pl-10 pr-4 h-10 text-sm transition-colors border-t border-white/10 ${
                                        location === href
                                          ? "bg-white/20 text-white font-semibold"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5 shrink-0 text-white/70" />
                                      <span className="flex-1">{label}</span>
                                      <ChevronRight className="w-3 h-3 text-white/40" />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SidebarMenuItem>
                        )}

                        {/* Asistencia submenu after Mapeo Estudiantes */}
                        {idx === 4 && (
                          <SidebarMenuItem>
                            <div className="border-b border-white/10">
                              <button
                                onClick={() => setAsistenciaOpen((o) => !o)}
                                className="w-full flex items-center gap-3 px-4 h-11 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <ClipboardCheck className="w-4 h-4 shrink-0 text-white/80" />
                                <span className="text-sm flex-1 text-left">Asistencia</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${asistenciaOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                              {asistenciaOpen && (
                                <div className="bg-black/15">
                                  {[
                                    { href: "/planillas-asistencia",       label: "Asistencia 2026-1",          Icon: ClipboardList },
                                    { href: "/reporte-asistencia",         label: "Reporte de Asistencia",      Icon: ClipboardList },
                                    { href: "/resultados-planillas",       label: "Desaprobado por Inasistencia", Icon: AlertTriangle },
                                    { href: "/docentes-sin-asistencias",   label: "Docentes sin Asistencias",   Icon: UserX },
                                  ].map(({ href, label, Icon }) => (
                                    <Link
                                      key={href}
                                      href={href}
                                      className={`flex items-center gap-3 pl-10 pr-4 h-10 text-sm transition-colors border-t border-white/10 ${
                                        location === href
                                          ? "bg-white/20 text-white font-semibold"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5 shrink-0 text-white/70" />
                                      <span className="flex-1">{label}</span>
                                      <ChevronRight className="w-3 h-3 text-white/40" />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SidebarMenuItem>
                        )}

                        {/* Supervisión Docente submenu after Mapeo Estudiantes */}
                        {idx === 4 && (
                          <SidebarMenuItem>
                            <div className="border-b border-white/10">
                              <button
                                onClick={() => setSupervisionOpen((o) => !o)}
                                className="w-full flex items-center gap-3 px-4 h-11 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <Eye className="w-4 h-4 shrink-0 text-white/80" />
                                <span className="text-sm flex-1 text-left">Supervisión Docente</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${supervisionOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                              {supervisionOpen && (
                                <div className="bg-black/15">
                                  {[
                                    { href: "/supervision/ruta", label: "Ruta de Supervisión", Icon: Route },
                                  ].map(({ href, label, Icon }) => (
                                    <Link
                                      key={href}
                                      href={href}
                                      className={`flex items-center gap-3 pl-10 pr-4 h-10 text-sm transition-colors border-t border-white/10 ${
                                        location === href
                                          ? "bg-white/20 text-white font-semibold"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5 shrink-0 text-white/70" />
                                      <span className="flex-1">{label}</span>
                                      <ChevronRight className="w-3 h-3 text-white/40" />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SidebarMenuItem>
                        )}

                        {/* Lista de Docentes submenu after Inicio */}
                        {idx === 0 && (
                          <SidebarMenuItem>
                            <div className="border-b border-white/10">
                              <button
                                onClick={() => setListaOpen((o) => !o)}
                                className="w-full flex items-center gap-3 px-4 h-11 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <UserCheck className="w-4 h-4 shrink-0 text-white/80" />
                                <span className="text-sm flex-1 text-left">Lista de Docentes</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${listaOpen ? "rotate-180" : ""}`}
                                />
                              </button>

                              {listaOpen && (
                                <div className="bg-black/15">
                                  {[
                                    { href: "/lista-docentes/fica",    label: "FICA" },
                                    { href: "/lista-docentes/fcs",     label: "FCS"  },
                                    { href: "/lista-docentes/fica-tc", label: "TC FICA" },
                                  ].map(({ href, label }) => (
                                    <Link
                                      key={href}
                                      href={href}
                                      className={`flex items-center gap-3 pl-10 pr-4 h-10 text-sm transition-colors border-t border-white/10 ${
                                        location === href
                                          ? "bg-white/20 text-white font-semibold"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <UserCheck className="w-3.5 h-3.5 shrink-0 text-white/70" />
                                      <span className="flex-1">{label}</span>
                                      <ChevronRight className="w-3 h-3 text-white/40" />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SidebarMenuItem>
                        )}
                      </React.Fragment>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Logout footer */}
          <SidebarFooter className="bg-sidebar border-t border-white/15 p-3">
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4" />
              {logoutMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}
            </button>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top header */}
          <header className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-white sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-primary hover:bg-primary/5" />
              <span className="text-sm font-semibold text-foreground tracking-wide">
                {getPageTitle(location)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Real-time clock with schedule popup */}
              {(() => {
                const slots = [
                  { label: "Mañana",    range: "07:00 – 12:59", start: 7,  end: 13, color: "bg-sky-500",    light: "bg-sky-50 border-sky-200 text-sky-700",    dot: "bg-sky-500" },
                  { label: "Tarde",     range: "13:00 – 18:59", start: 13, end: 19, color: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
                  { label: "Noche",     range: "19:00 – 22:59", start: 19, end: 23, color: "bg-violet-500",  light: "bg-violet-50 border-violet-200 text-violet-700",  dot: "bg-violet-500" },
                  { label: "Madrugada",range: "23:00 – 06:59", start: 23, end: 7,  color: "bg-slate-400",   light: "bg-slate-50 border-slate-200 text-slate-500",    dot: "bg-slate-400" },
                ];
                const active = slots.find(s =>
                  s.start < s.end
                    ? peruHour >= s.start && peruHour < s.end
                    : peruHour >= s.start || peruHour < s.end
                ) ?? slots[3];
                return (
                  <div ref={clockRef} className="relative hidden sm:block">
                    <button
                      onClick={() => setClockOpen(o => !o)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${clockOpen ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted text-foreground hover:border-primary/20"}`}
                    >
                      <Clock size={13} className={clockOpen ? "text-primary" : "text-muted-foreground"} />
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-sm font-bold tabular-nums tracking-tight">{timeStr}</span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{dateStr}</span>
                      </div>
                    </button>

                    {clockOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden">
                        <div className={`${active.color} px-4 py-3`}>
                          <p className="text-white text-xs font-semibold uppercase tracking-widest opacity-80">Turno actual</p>
                          <p className="text-white text-xl font-black tracking-tight">{active.label}</p>
                          <p className="text-white/70 text-xs font-mono mt-0.5">{active.range}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {slots.slice(0, 3).map(s => {
                            const isCurrent = s.label === active.label;
                            return (
                              <div key={s.label} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${isCurrent ? s.light + " font-semibold" : "bg-muted/40 border-transparent text-muted-foreground"}`}>
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm">{s.label}</span>
                                  <span className="text-xs ml-2 font-mono opacity-70">{s.range}</span>
                                </div>
                                {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wide">← Ahora</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="px-4 pb-3 -mt-1">
                          <div className="text-center text-xs text-muted-foreground font-mono bg-muted rounded-lg py-1.5 tabular-nums">{timeStr} · Hora Perú (UTC -5)</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Quick-access grid button */}
              <div ref={gridRef} className="relative">
                <button
                  onClick={() => setGridOpen((o) => !o)}
                  className={`p-2 rounded-lg transition-colors ${gridOpen ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                {gridOpen && (
                  <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-border bg-white shadow-lg p-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">Acceso rápido</p>
                    {[
                      { href: "/rectificaciones",     label: "Registros de Rectificaciones", icon: FileEdit },
                      { href: "/verificacion-data",   label: "Verificación de Data",         icon: DatabaseZap },
                      { href: "/reporte-estudiantes", label: "Reporte de Estudiantes",       icon: ClipboardList },
                      { href: "/reportes",            label: "Reportes",                     icon: BarChart3 },
                      { href: "/usuarios",            label: "Usuarios",                     icon: Users },
                      { href: "/calendario",          label: "Calendario 2026",              icon: CalendarIcon },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setGridOpen(false)}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                      >
                        <Icon className="w-4 h-4 text-primary/70" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                <Bell className="w-5 h-5" />
              </button>

              <Link
                href="/configuracion"
                className="flex items-center gap-3 pl-3 border-l border-border rounded-lg px-2 py-1 -mr-1 hover:bg-muted/60 transition-colors group"
                title="Mi cuenta"
              >
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-foreground leading-tight uppercase tracking-wide group-hover:text-primary">
                    {user.fullName}
                  </span>
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
                <Avatar className="w-9 h-9 shrink-0 border-2 border-primary/20 group-hover:border-primary/60 transition-colors">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-white font-bold text-xs">
                    {user.fullName?.substring(0, 2).toUpperCase() || "UA"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </header>

          <main
            className={`flex-1 overflow-auto ${location === "/" ? "" : "p-4 md:p-6 bg-white"}`}
          >
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
