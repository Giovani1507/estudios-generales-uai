import { useState } from "react";
import { useListTeachers, useListSchedules } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function TeacherSchedules() {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  
  const { data: teachers, isLoading: isLoadingTeachers } = useListTeachers();
  const { data: schedules, isLoading: isLoadingSchedules } = useListSchedules(
    { teacherId: selectedTeacherId ? parseInt(selectedTeacherId) : undefined },
    { query: { enabled: !!selectedTeacherId } }
  );

  const daysOrder = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  
  const sortedSchedules = schedules?.sort((a, b) => {
    const dayDiff = daysOrder.indexOf(a.dayOfWeek) - daysOrder.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  const selectedTeacher = teachers?.find(t => t.id.toString() === selectedTeacherId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Horario Docente</h1>
          <p className="text-muted-foreground">Consulte los horarios asignados filtrando por docente.</p>
        </div>
      </div>

      <Card className="border-none shadow-lg shadow-primary/5">
        <CardHeader className="bg-primary/5 border-b border-border/50 pb-6 rounded-t-xl">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <label className="text-sm font-bold text-primary mb-2 block">Seleccione un Docente</label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} disabled={isLoadingTeachers}>
                <SelectTrigger className="w-full h-12 rounded-xl border-2 focus:ring-primary/20 bg-white">
                  <SelectValue placeholder="Buscar docente..." />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.fullName} — {teacher.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTeacher && (
              <div className="flex-1 w-full bg-white p-4 rounded-xl border border-border/50 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary text-lg">{selectedTeacher.fullName.substring(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selectedTeacher.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTeacher.specialty} • {selectedTeacher.email}</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedTeacherId ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <Search className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Ningún docente seleccionado</h3>
              <p className="text-muted-foreground">Utilice el filtro superior para visualizar el horario.</p>
            </div>
          ) : isLoadingSchedules ? (
            <div className="py-24 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sortedSchedules && sortedSchedules.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-bold text-primary">Día</TableHead>
                    <TableHead className="font-bold text-primary">Horario</TableHead>
                    <TableHead className="font-bold text-primary">Asignatura</TableHead>
                    <TableHead className="font-bold text-primary">Sección</TableHead>
                    <TableHead className="font-bold text-primary text-right">Aula</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSchedules.map((schedule) => (
                    <TableRow key={schedule.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-semibold capitalize">
                        <Badge variant="outline" className="bg-white">{schedule.dayOfWeek}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="w-4 h-4 text-accent" />
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {schedule.courseName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{schedule.sectionName}</Badge>
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
              <p className="text-muted-foreground">El docente no tiene clases programadas en este momento.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
