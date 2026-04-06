import React, { ReactNode, useMemo, useState } from "react";
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
  Bell,
  LayoutGrid,
  FolderOpen,
  ChevronDown,
  CalendarDays,
  School,
  AlertTriangle,
  UserCheck,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    title: "Calendario 2026",
    url: "/calendario",
    icon: CalendarIcon,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Estudiantes",
    url: "/estudiantes",
    icon: Users,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Usuarios",
    url: "/usuarios",
    icon: Users,
    roles: ["administrador"],
  },
  {
    title: "Roles y Permisos",
    url: "/roles",
    icon: ShieldCheck,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Avisos y Comunicados",
    url: "/avisos",
    icon: BellRing,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Reportes",
    url: "/reportes",
    icon: BarChart3,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Registro de Actividad",
    url: "/actividad",
    icon: Activity,
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
    location.startsWith("/horarios")
  );
  const [listaOpen, setListaOpen] = useState(
    location.startsWith("/lista-docentes")
  );

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
      href: "/horarios/seccion",
      label: "Horario por Carrera",
      Icon: BookOpen,
    },
    {
      href: "/horarios/carrera",
      label: "Horario por Aula",
      Icon: School,
    },
    {
      href: "/planificacion/crear",
      label: "Crear Planificación",
      Icon: ClipboardList,
    },
    {
      href: "/planificacion/cruce",
      label: "Cruce de Planificación",
      Icon: AlertTriangle,
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
                                <span className="text-sm flex-1 text-left">Planificación</span>
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
                                    { href: "/lista-docentes/fica", label: "FICA" },
                                    { href: "/lista-docentes/fcs",  label: "FCS"  },
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
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-primary hover:bg-primary/5" />
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                <Bell className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-foreground leading-tight uppercase tracking-wide">
                    {user.fullName}
                  </span>
                  <span className="text-xs font-bold text-accent uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
                <Avatar className="w-9 h-9 shrink-0 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary text-white font-bold text-xs">
                    {user.fullName?.substring(0, 2).toUpperCase() || "UA"}
                  </AvatarFallback>
                </Avatar>
              </div>
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
