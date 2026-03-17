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
  Building2
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
      }
    }
  });

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background/50">
        <Sidebar variant="sidebar" className="border-r shadow-xl shadow-primary/5">
          <SidebarContent>
            <div className="px-4 pt-6 pb-5 flex flex-col items-center border-b border-sidebar-border/60 gap-3">
              <div className="bg-muted/40 border border-border rounded-2xl px-4 py-3 w-full flex items-center justify-center" style={{minHeight:'72px'}}>
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="Universidad Autónoma de Ica"
                  className="object-contain w-full"
                  style={{maxHeight:'56px'}}
                />
              </div>
              <p className="text-xs font-semibold tracking-wider" style={{color:'hsl(var(--sidebar-primary))'}}>
                Estudios Generales · 2026-1
              </p>
            </div>
            <SidebarGroup className="px-4 py-6">
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-2 px-3">Menú Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {filteredMenu.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className={`
                            rounded-lg transition-all duration-200 h-10 px-3
                            ${isActive 
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' 
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
                          `}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50'}`} />
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
          <SidebarFooter className="border-t border-sidebar-border/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-9 h-9 shrink-0 border-2 border-sidebar-accent">
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-bold text-sm">
                    {user.fullName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">{user.fullName}</span>
                  <span className="text-xs text-sidebar-primary font-medium capitalize">{user.role}</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-400/10 rounded-lg shrink-0"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary hover:bg-primary/10" />
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="w-4 h-4 text-accent" />
                <span>Instituto Universitario Autónoma de Caripito</span>
              </div>
            </div>
            <div className="text-sm font-semibold text-primary">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </header>
          
          <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10 relative">
            {/* Subtle background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />
            
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
