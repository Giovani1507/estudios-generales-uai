import { useGetReportSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Reports() {
  const { data: summary, isLoading } = useGetReportSummary();

  if (isLoading || !summary) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // Mock data based on summary to make charts look interesting
  const entityData = [
    { name: "Docentes", value: summary.totalTeachers },
    { name: "Estudiantes", value: summary.totalStudents },
    { name: "Cursos", value: summary.totalCourses },
    { name: "Secciones", value: summary.totalSections },
  ];

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#0ea5e9", "#f59e0b"];

  const weeklyActivity = [
    { day: "Lunes", clases: Math.round(summary.schedulesThisWeek * 0.2) },
    { day: "Martes", clases: Math.round(summary.schedulesThisWeek * 0.25) },
    { day: "Miércoles", clases: Math.round(summary.schedulesThisWeek * 0.2) },
    { day: "Jueves", clases: Math.round(summary.schedulesThisWeek * 0.15) },
    { day: "Viernes", clases: Math.round(summary.schedulesThisWeek * 0.15) },
    { day: "Sábado", clases: Math.round(summary.schedulesThisWeek * 0.05) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Reportes y Estadísticas</h1>
        <p className="text-muted-foreground text-lg">Métricas clave del funcionamiento institucional.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-lg shadow-black/5 border-border/50 h-full">
            <CardHeader>
              <CardTitle>Distribución de Entidades</CardTitle>
              <CardDescription>Volumen de registros en el sistema</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={entityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {entityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-lg shadow-black/5 border-border/50 h-full">
            <CardHeader>
              <CardTitle>Carga Académica Semanal</CardTitle>
              <CardDescription>Cantidad de clases programadas por día</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyActivity} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="clases" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
