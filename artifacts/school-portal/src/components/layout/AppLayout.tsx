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
            <div className="p-6 flex flex-col items-center justify-center border-b border-border/50 bg-primary/5">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-border/50 flex items-center justify-center p-2 mb-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="IUAC Logo" className="w-full h-full object-contain relative z-10" />
              </div>
              <h2 className="font-display font-bold text-lg text-primary text-center leading-tight">IUAC</h2>
              <p className="text-xs text-muted-foreground text-center font-medium">Portal Académico</p>
            </div>
            <SidebarGroup className="px-4 py-6">
              <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Menú Principal</SidebarGroupLabel>
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
                            rounded-xl transition-all duration-200 h-11 px-4
                            ${isActive 
                              ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground' 
                              : 'text-foreground/70 hover:bg-primary/10 hover:text-primary hover:font-medium'}
                          `}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-accent-foreground' : 'text-primary/60'}`} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border/50 p-4 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {user.fullName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground leading-tight">{user.fullName}</span>
                  <span className="text-xs text-accent font-medium capitalize">{user.role}</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
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
