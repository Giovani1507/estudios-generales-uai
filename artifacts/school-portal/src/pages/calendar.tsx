import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

export default function Calendar2026() {
  const year = 2026;
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left mb-8">
        <h1 className="text-4xl font-display font-bold text-primary mb-2">Calendario Académico {year}</h1>
        <p className="text-muted-foreground text-lg">Cronograma general de actividades de la institución.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {months.map((monthDate, idx) => {
          const start = startOfMonth(monthDate);
          const end = endOfMonth(monthDate);
          const days = eachDayOfInterval({ start, end });
          
          // Adjust for starting day (1 = Monday, ..., 0 = Sunday)
          const startDay = getDay(start);
          const emptyDaysBefore = startDay === 0 ? 6 : startDay - 1;

          return (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-border/50 shadow-lg shadow-black/5 hover:shadow-xl hover:border-primary/30 transition-all overflow-hidden h-full flex flex-col bg-white">
                <div className="bg-primary text-primary-foreground py-3 text-center border-b-4 border-accent">
                  <h3 className="font-display font-bold text-xl capitalize">
                    {format(monthDate, 'MMMM', { locale: es })}
                  </h3>
                </div>
                <CardContent className="p-4 flex-1">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map(d => (
                      <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: emptyDaysBefore }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8" />
                    ))}
                    {days.map((day) => {
                      const isWknd = isWeekend(day);
                      // Example highlighted days (mock logic for visual variety)
                      const isHoliday = idx === 0 && day.getDate() === 1; // Jan 1
                      const isExam = (idx === 6 || idx === 11) && day.getDate() > 10 && day.getDate() < 15;
                      
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`
                            h-8 sm:h-10 rounded-md flex items-center justify-center text-sm font-medium transition-all
                            ${isHoliday ? 'bg-destructive/10 text-destructive font-bold ring-1 ring-destructive/30' : 
                              isExam ? 'bg-accent/10 text-accent font-bold ring-1 ring-accent/30' : 
                              isWknd ? 'text-muted-foreground bg-muted/20' : 'text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer'}
                          `}
                          title={isHoliday ? "Feriado" : isExam ? "Período de Exámenes" : ""}
                        >
                          {format(day, 'd')}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-8 p-4 bg-white rounded-xl border border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-4 h-4 rounded-md bg-destructive/10 ring-1 ring-destructive/30"></div>
          Feriados
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-4 h-4 rounded-md bg-accent/10 ring-1 ring-accent/30"></div>
          Período de Exámenes
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-4 h-4 rounded-md bg-muted/20"></div>
          Fines de Semana
        </div>
      </div>
    </div>
  );
}
