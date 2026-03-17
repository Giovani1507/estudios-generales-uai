import { ReactNode } from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const menuItems = [
  { title: "Inicio", url: "/", icon: LayoutDashboard, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Horarios Docentes", url: "/horarios-docentes", icon: Clock, roles: ["administrador", "coordinador"] },
  { title: "Horarios por Sección", url: "/horarios-seccion", icon: GraduationCap, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Cursos y Asignaturas", url: "/cursos", icon: BookOpen, roles: ["administrador", "coordinador"] },
  { title: "Calendario 2026", url: "/calendario", icon: CalendarIcon, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Usuarios", url: "/usuarios", icon: Users, roles: ["administrador"] },
  { title: "Roles y Permisos", url: "/roles", icon: ShieldCheck, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Avisos y Comunicados", url: "/avisos", icon: BellRing, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Reportes", url: "/reportes", icon: BarChart3, roles: ["administrador", "coordinador", "administrativo"] },
  { title: "Configuración", url: "/configuracion", icon: Settings, roles: ["administrador", "coordinador"] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = import.meta.env.BASE_URL + "login";
      },
    },
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredMenu = menuItems.filter((item) => item.roles.includes(user.role));

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background/50">
        <Sidebar variant="sidebar" className="border-r border-border/50 shadow-sm">
          <SidebarContent className="flex flex-col">
            {/* Header: logo blended on white, no box */}
            <div className="px-5 pt-7 pb-5 flex flex-col items-center text-center border-b border-border/50">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Universidad Autónoma de Ica"
                className="object-contain mb-4"
                style={{ maxWidth: "180px", maxHeight: "60px" }}
              />
              <h2 className="text-lg font-extrabold text-foreground leading-tight uppercase tracking-wide">
                Control<br />Académico
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Estudios Generales 2026-1
              </p>
            </div>

            {/* Menu */}
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
                            ${isActive
                              ? "bg-primary text-white font-semibold shadow-sm"
                              : "text-foreground/70 hover:bg-muted hover:text-foreground"}
                          `}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            <item.icon
                              className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-muted-foreground"}`}
                            />
                            <span className="text-sm">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer: user info + cerrar sesión */}
          <SidebarFooter className="border-t border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-9 h-9 shrink-0 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {user.fullName.substring(0, 2).toUpperCase()}
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
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-all"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 flex items-center justify-between px-6 border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary hover:bg-primary/10" />
              <span className="text-sm font-medium text-muted-foreground">
                Universidad Autónoma de Ica
              </span>
            </div>
            <div className="text-sm font-semibold text-primary">
              {new Date().toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
