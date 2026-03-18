import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isToday,
  addMonths,
  subMonths,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Eventos de ejemplo.
// Luego puedes cambiar estas fechas por las reales de tu institución.
const academicEvents = [
  { date: "2026-03-05", title: "Inicio de matrículas" },
  { date: "2026-03-12", title: "Reunión docente" },
  { date: "2026-03-17", title: "Entrega de sílabos" },
  { date: "2026-03-24", title: "Inicio de evaluaciones" },
  { date: "2026-03-30", title: "Cierre de inscripciones" },
];

function MonthGrid({
  monthDate,
  today,
  selectedDate,
  onSelectDate,
}: {
  monthDate: Date;
  today: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });

  const startDay = getDay(start);
  const emptyBefore = startDay === 0 ? 6 : startDay - 1;

  const hasEvent = (day: Date) =>
    academicEvents.some((event) => isSameDay(new Date(event.date), day));

  const isWeekendCustom = (day: Date) => {
    const d = getDay(day);
    return d === 0 || d === 6;
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-bold text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: emptyBefore }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const weekend = isWeekendCustom(day);
          const todayDay = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const eventDay = hasEvent(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`
                relative h-11 rounded-xl flex items-center justify-center text-sm font-medium transition-all
                border
                ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : todayDay
                      ? "border-primary text-primary bg-primary/10"
                      : weekend
                        ? "text-muted-foreground border-transparent hover:bg-muted/40"
                        : "text-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                }
              `}
            >
              {format(day, "d")}

              {eventDay && (
                <span
                  className={`
                    absolute bottom-1 w-1.5 h-1.5 rounded-full
                    ${selected ? "bg-white" : "bg-primary"}
                  `}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar2026() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const goBack = () => setViewDate((d) => subMonths(d, 1));
  const goForward = () => setViewDate((d) => addMonths(d, 1));
  const goToday = () => {
    setViewDate(today);
    setSelectedDate(today);
  };

  const monthLabel = format(viewDate, "MMMM yyyy", { locale: es });
  const capitalizedMonth =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const fullTodayText = format(today, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
  const formattedTodayText =
    fullTodayText.charAt(0).toUpperCase() + fullTodayText.slice(1);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return academicEvents.filter((event) =>
      isSameDay(new Date(event.date), selectedDate),
    );
  }, [selectedDate]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-1">
            Calendario Académico
          </h1>
          <p className="text-muted-foreground">{formattedTodayText}</p>
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

      {/* Calendario principal */}
      <motion.div
        key={viewDate.toISOString()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="border-border shadow-lg overflow-hidden rounded-2xl">
          <div
            className="flex items-center justify-between px-6 py-4 text-white"
            style={{ background: "hsl(218,75%,32%)" }}
          >
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold tracking-wide">
              {capitalizedMonth}
            </h2>

            <button
              onClick={goForward}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <CardContent className="p-6">
            <MonthGrid
              monthDate={viewDate}
              today={today}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Panel de detalle del día seleccionado */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {selectedDate
                  ? format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", {
                      locale: es,
                    })
                  : "Selecciona una fecha"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Consulta las actividades académicas programadas para el día.
              </p>
            </div>

            {selectedEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedEvents.map((event, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
                  >
                    <p className="font-medium text-primary">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Fecha programada:{" "}
                      {format(new Date(event.date), "d 'de' MMMM 'de' yyyy", {
                        locale: es,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                No hay eventos registrados para esta fecha.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-5 p-4 bg-white rounded-xl border border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">
            {format(today, "d")}
          </div>
          <span>Hoy</span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-8 h-8 rounded-lg border border-primary flex items-center justify-center text-primary text-xs font-bold">
            15
          </div>
          <span>Fecha seleccionada</span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-xs relative">
            10
            <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <span>Evento académico</span>
        </div>
      </div>
    </div>
  );
}
