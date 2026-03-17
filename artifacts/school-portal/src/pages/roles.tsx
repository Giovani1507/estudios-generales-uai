import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Shield, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Roles() {
  const rolesInfo = [
    {
      title: "Administrador",
      icon: ShieldCheck,
      color: "text-destructive",
      bg: "bg-destructive/10",
      description: "Acceso total y control completo sobre el sistema del Portal Académico.",
      permissions: [
        "Crear, editar, desactivar y eliminar usuarios",
        "Asignar contraseñas y cambiar roles de cualquier usuario",
        "Acceso sin restricciones a todos los módulos (Horarios, Cursos, Avisos, etc.)",
        "Gestión y configuración global de la plataforma",
        "Acceso a auditorías y reportes completos"
      ]
    },
    {
      title: "Coordinador",
      icon: Shield,
      color: "text-primary",
      bg: "bg-primary/10",
      description: "Encargado de la supervisión académica y la gestión de docentes.",
      permissions: [
        "Ver y gestionar horarios generales y por sección",
        "Supervisar carga y actividad de docentes",
        "Crear y publicar avisos o comunicados importantes",
        "Revisar reportes de gestión y estadísticas",
        "No tiene acceso a la creación de nuevos usuarios"
      ]
    },
    {
      title: "Administrativo",
      icon: UserCircle,
      color: "text-accent",
      bg: "bg-accent/10",
      description: "Personal de apoyo para consultas y procesos operativos básicos.",
      permissions: [
        "Ver reportes estadísticos y resúmenes",
        "Visualizar horarios (solo lectura)",
        "Visualizar el calendario académico",
        "Leer avisos y comunicados",
        "Gestión de información académica básica delegada"
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Roles y Permisos</h1>
        <p className="text-muted-foreground text-lg">Información sobre los niveles de acceso y jerarquías dentro del sistema.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {rolesInfo.map((role, idx) => (
          <motion.div key={role.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className="h-full border-border/50 shadow-lg shadow-black/5 flex flex-col hover:border-primary/30 transition-all">
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${role.bg}`}>
                  <role.icon className={`w-8 h-8 ${role.color}`} />
                </div>
                <CardTitle className="text-2xl font-display text-foreground">{role.title}</CardTitle>
                <CardDescription className="text-sm mt-2">{role.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 bg-muted/20 m-4 rounded-xl p-6">
                <h4 className="font-bold text-sm text-primary uppercase tracking-wider mb-4">Permisos Autorizados</h4>
                <ul className="space-y-3">
                  {role.permissions.map((perm, pIdx) => (
                    <li key={pIdx} className="flex items-start text-sm text-muted-foreground">
                      <div className="mt-1 mr-2 shrink-0 w-1.5 h-1.5 rounded-full bg-primary/50" />
                      <span className="leading-tight">{perm}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
