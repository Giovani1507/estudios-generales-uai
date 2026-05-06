import { useLogPageEntry } from "@/hooks/use-activity-log";
import { ClipboardList } from "lucide-react";

export default function ReporteEstudiantes() {
  useLogPageEntry("Reporte de Estudiantes");

  return (
    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
      <ClipboardList className="h-12 w-12 opacity-30" />
      <p className="text-sm">Página en construcción</p>
    </div>
  );
}
