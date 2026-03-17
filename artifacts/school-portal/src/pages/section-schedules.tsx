import { useState } from "react";
import { useListSections, useListSchedules } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Search, User } from "lucide-react";
import { motion } from "framer-motion";

export default function SectionSchedules() {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  
  const { data: sections, isLoading: isLoadingSections } = useListSections();
  const { data: schedules, isLoading: isLoadingSchedules } = useListSchedules(
    { sectionId: selectedSectionId ? parseInt(selectedSectionId) : undefined },
    { query: { enabled: !!selectedSectionId } }
  );

  const daysOrder = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  
  const sortedSchedules = schedules?.sort((a, b) => {
    const dayDiff = daysOrder.indexOf(a.dayOfWeek) - daysOrder.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  const selectedSection = sections?.find(s => s.id.toString() === selectedSectionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Horario por Sección</h1>
          <p className="text-muted-foreground">Consulte los horarios estructurados filtrando por sección académica.</p>
        </div>
      </div>

      <Card className="border-none shadow-lg shadow-primary/5">
        <CardHeader className="bg-primary/5 border-b border-border/50 pb-6 rounded-t-xl">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <label className="text-sm font-bold text-primary mb-2 block">Seleccione una Sección</label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={isLoadingSections}>
                <SelectTrigger className="w-full h-12 rounded-xl border-2 focus:ring-primary/20 bg-white">
                  <SelectValue placeholder="Buscar sección..." />
                </SelectTrigger>
                <SelectContent>
                  {sections?.map(section => (
                    <SelectItem key={section.id} value={section.id.toString()}>
                      {section.name} — {section.grade} ({section.shift})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSection && (
              <div className="flex-1 w-full bg-white p-4 rounded-xl border border-border/50 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="font-bold text-accent text-lg">{selectedSection.name}</span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Grado: {selectedSection.grade}</h3>
                  <p className="text-sm text-muted-foreground capitalize">Turno {selectedSection.shift} • {selectedSection.capacity} Estudiantes</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedSectionId ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <Search className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Ninguna sección seleccionada</h3>
              <p className="text-muted-foreground">Utilice el filtro superior para visualizar el horario.</p>
            </div>
          ) : isLoadingSchedules ? (
            <div className="py-24 flex justify-center">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sortedSchedules && sortedSchedules.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-bold text-primary">Día</TableHead>
                    <TableHead className="font-bold text-primary">Horario</TableHead>
                    <TableHead className="font-bold text-primary">Asignatura</TableHead>
                    <TableHead className="font-bold text-primary">Docente</TableHead>
                    <TableHead className="font-bold text-primary text-right">Aula</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSchedules.map((schedule) => (
                    <TableRow key={schedule.id} className="hover:bg-accent/5 transition-colors">
                      <TableCell className="font-semibold capitalize">
                        <Badge variant="outline" className="bg-white border-accent/20 text-accent">{schedule.dayOfWeek}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {schedule.courseName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-primary/50" />
                          {schedule.teacherName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 text-sm font-medium text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {schedule.classroom}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </motion.div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <Calendar className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Sin horarios asignados</h3>
              <p className="text-muted-foreground">Esta sección no tiene clases programadas en este momento.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
