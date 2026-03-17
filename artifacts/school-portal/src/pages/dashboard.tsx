import { useAuth } from "@/lib/auth";
import { useGetReportSummary, useListAnnouncements } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  Calendar as CalendarIcon,
  Bell,
  ArrowRight,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: isLoadingSummary } = useGetReportSummary();
  const { data: announcements, isLoading: isLoadingAnnouncements } = useListAnnouncements();

  const activeAnnouncements = announcements?.filter(a => new Date(a.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Bienvenido, {user?.fullName}</h1>
          <p className="text-muted-foreground text-lg">Panel de control principal del {user?.role}.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Docentes Activos", value: summary?.totalTeachers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { title: "Cursos Registrados", value: summary?.totalCourses || 0, icon: BookOpen, color: "text-accent", bg: "bg-accent/10" },
          { title: "Secciones Activas", value: summary?.totalSections || 0, icon: GraduationCap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { title: "Clases Semanales", value: summary?.schedulesThisWeek || 0, icon: CalendarIcon, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-none shadow-lg shadow-primary/5 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                    {isLoadingSummary ? (
                      <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
                    ) : (
                      <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Announcements */}
        <Card className="lg:col-span-2 border-none shadow-lg shadow-primary/5 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl">Avisos Recientes</CardTitle>
              <CardDescription>Comunicados importantes de la institución</CardDescription>
            </div>
            <Link href="/avisos" className="text-sm font-semibold text-primary hover:text-accent transition-colors flex items-center">
              Ver todos <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoadingAnnouncements ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : activeAnnouncements.length > 0 ? (
              <div className="space-y-4">
                {activeAnnouncements.slice(0, 4).map(announcement => (
                  <div key={announcement.id} className="p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{announcement.title}</h4>
                      <Badge variant={announcement.priority === 'urgente' ? 'destructive' : announcement.priority === 'importante' ? 'default' : 'secondary'} className="capitalize shrink-0">
                        {announcement.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{announcement.content}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-2 font-medium">
                      <span>Por: {announcement.authorName}</span>
                      <span>•</span>
                      <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl">
                <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No hay avisos recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions / Info */}
        <Card className="border-none shadow-lg shadow-primary/5 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-xl text-white">Accesos Rápidos</CardTitle>
            <CardDescription className="text-white/70">Navegación frecuente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Consultar Calendario 2026", url: "/calendario", icon: CalendarIcon },
                { label: "Ver Horarios Docentes", url: "/horarios-docentes", icon: Clock },
                { label: "Gestión de Cursos", url: "/cursos", icon: BookOpen },
              ].map((action, i) => (
                <Link key={i} href={action.url} className="flex items-center p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/5 group">
                  <action.icon className="w-5 h-5 text-white/80 mr-3 group-hover:text-white" />
                  <span className="font-medium text-white/90 group-hover:text-white">{action.label}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-white/50 group-hover:text-white transition-colors group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
            
            <div className="mt-8 p-5 rounded-xl bg-black/20 backdrop-blur-sm border border-white/10">
              <h4 className="font-bold text-white mb-2">Soporte Técnico</h4>
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                Si tiene problemas con el sistema, contacte a la mesa de ayuda.
              </p>
              <Button variant="secondary" className="w-full bg-white text-primary hover:bg-white/90">
                Contactar Soporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
