import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isWeekend,
  getDay,
  isToday,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function MonthGrid({ monthDate, today }: { monthDate: Date; today: Date }) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });

  const startDay = getDay(start);
  const emptyBefore = startDay === 0 ? 6 : startDay - 1;

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-bold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyBefore }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {days.map((day) => {
          const weekend = isWeekend(day);
          const todayDay = isToday(day);
          const currentMonth = isSameMonth(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`
                h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all select-none
                ${todayDay
                  ? "bg-primary text-primary-foreground font-bold ring-2 ring-primary/40 shadow-md"
                  : weekend
                    ? "text-muted-foreground"
                    : "text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                }
              `}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar2026() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(today);

  const goBack = () => setViewDate((d) => subMonths(d, 1));
  const goForward = () => setViewDate((d) => addMonths(d, 1));
  const goToday = () => setViewDate(today);

  const monthLabel = format(viewDate, "MMMM yyyy", { locale: es });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Generate 3 months: previous, current, next for mini preview
  const prevMonth = subMonths(viewDate, 1);
  const nextMonth = addMonths(viewDate, 1);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-1">Calendario Académico</h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
              .charAt(0)
              .toUpperCase() +
              format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }).slice(1)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goToday}
          className="text-primary border-primary/30 hover:bg-primary/5"
        >
          Hoy
        </Button>
      </div>

      {/* Main month card */}
      <motion.div
        key={viewDate.toISOString()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="border-border shadow-lg overflow-hidden">
          {/* Month header with navigation */}
          <div
            className="flex items-center justify-between px-6 py-4 text-white"
            style={{ background: "hsl(218,75%,32%)" }}
          >
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold tracking-wide">{capitalizedMonth}</h2>
            <button
              onClick={goForward}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <CardContent className="p-6">
            <MonthGrid monthDate={viewDate} today={today} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Mini previews: previous and next months */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[prevMonth, nextMonth].map((m, idx) => (
          <Card
            key={idx}
            className="border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setViewDate(m)}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ background: "hsl(215 30% 97%)" }}
            >
              <h3 className="font-semibold text-sm text-foreground capitalize">
                {format(m, "MMMM yyyy", { locale: es })}
              </h3>
              <span className="text-xs text-muted-foreground">Ver mes →</span>
            </div>
            <CardContent className="p-4">
              <MonthGrid monthDate={m} today={today} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 p-4 bg-white rounded-xl border border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">
            {format(today, "d")}
          </div>
          <span>Hoy</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground text-xs">
            S
          </div>
          <span>Fin de semana</span>
        </div>
      </div>
    </div>
  );
}
