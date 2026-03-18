import React, { ReactNode, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  GraduationCap,
  Clock,
  LogOut,
  ChevronRight,
  ClipboardList,
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
    title: "Horarios Docentes",
    url: "/horarios-docentes",
    icon: Clock,
    roles: ["administrador", "coordinador"],
  },
  {
    title: "Horarios por Sección",
    url: "/horarios-seccion",
    icon: GraduationCap,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Cursos y Asignaturas",
    url: "/cursos",
    icon: BookOpen,
    roles: ["administrador", "coordinador"],
  },
  {
    title: "Calendario 2026",
    url: "/calendario",
    icon: CalendarIcon,
    roles: ["administrador", "coordinador", "administrativo"],
  },
  {
    title: "Directiva de Matrícula",
    url: "/directiva-matricula",
    icon: ClipboardList,
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

  const filteredMenu = useMemo(() => {
    if (!user?.role) return [];
    return menuItems.filter((item) =>
      item.roles.includes(user.role as UserRole),
    );
  }, [user?.role]);

  const currentPageTitle = useMemo(() => getPageTitle(location), [location]);

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

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "17rem" } as React.CSSProperties}
    >
      <div className="flex min-h-screen w-full bg-background/50">
        <Sidebar
          variant="sidebar"
          className="border-r border-border/50 shadow-sm"
        >
          <SidebarContent className="flex flex-col">
            <div className="px-5 pt-7 pb-5 flex flex-col items-center text-center border-b border-border/50">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Universidad Autónoma de Ica"
                className="object-contain mb-4"
                style={{ maxWidth: "180px", maxHeight: "60px" }}
              />
              <h2 className="text-lg font-extrabold text-foreground leading-tight uppercase tracking-wide">
                Control
                <br />
                Académico
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Estudios Generales 2026-1
              </p>
            </div>

            <SidebarGroup className="px-3 py-5 flex-1">
              <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
                Menú Principal
              </SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {filteredMenu.map((item) => {
                    const isActive = location === item.url;

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={`
                            rounded-xl transition-all duration-150 h-11 px-3
                            ${
                              isActive
                                ? "bg-primary text-white font-semibold shadow-sm"
                                : "text-foreground/70 hover:bg-muted hover:text-foreground"
                            }
                          `}
                        >
                          <Link
                            href={item.url}
                            className="flex items-center gap-3"
                          >
                            <item.icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive
                                  ? "text-white"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span className="text-sm flex-1 text-left">
                              {item.title}
                            </span>
                            {isActive && (
                              <ChevronRight className="w-4 h-4 text-white/90" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-10 h-10 shrink-0 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {user.fullName?.substring(0, 2).toUpperCase() || "UA"}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground leading-tight truncate">
                  {user.fullName}
                </span>
                <span className="text-xs text-muted-foreground font-medium capitalize">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4" />
              {logoutMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}
            </button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 flex items-center justify-between px-6 border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-primary hover:bg-primary/10" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">
                  {currentPageTitle}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  Universidad Autónoma de Ica
                </span>
              </div>
            </div>

            <div className="hidden md:block text-sm font-semibold text-primary capitalize">
              {new Date().toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />

            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
