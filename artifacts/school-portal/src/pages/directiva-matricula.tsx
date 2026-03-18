import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, ExternalLink, ChevronDown, ChevronUp, CalendarDays, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const pdfUrl = `${import.meta.env.BASE_URL}directiva-matricula-2026-1.pdf`;

/* ── Calendario académico ── */
const calendarioActividades = [
  { actividad: "Matrícula Regular", fecha: "Del 23 de marzo al 04 de abril 2026", highlight: false },
  { actividad: "Reserva de Matrícula", fecha: "Del 23 de marzo al 11 de abril 2026", highlight: false },
  { actividad: "Matrícula Extemporánea", fecha: "Del 06 de abril al 18 de abril 2026", highlight: false },
  { actividad: "Matrícula por Cobertura", fecha: "Del 20 de abril al 25 de abril 2026", highlight: false },
  { actividad: "Inicio de Clases del 1° al 12° Ciclo", fecha: "06 de abril de 2026", highlight: true },
];

const rolEvaluaciones = [
  { actividad: "Evaluación de Parcial 1", fecha: "Del 04 al 10 de mayo 2026", highlight: false },
  { actividad: "Evaluación de Parcial 2", fecha: "Del 08 al 14 de junio 2026", highlight: false },
  { actividad: "Evaluación de Parcial 3", fecha: "Del 20 al 26 de julio 2026", highlight: false },
  { actividad: "Término de Clases", fecha: "26 de julio de 2026", highlight: true },
  { actividad: "Exámenes Aplazados", fecha: "03 y 04 de agosto 2026", highlight: false },
  { actividad: "Cierre de Semestre", fecha: "08 de agosto 2026", highlight: false },
];

/* ── Cuotas ── */
const cuotas = [
  { numero: "Cuota 1", fecha: "06 de abril 2026" },
  { numero: "Cuota 2", fecha: "02 de mayo 2026" },
  { numero: "Cuota 3", fecha: "27 de mayo 2026" },
  { numero: "Cuota 4", fecha: "22 de junio 2026" },
  { numero: "Cuota 5", fecha: "17 de julio 2026" },
];

/* ── Cronograma matrícula regular ── */
const cronograma = [
  { fechaPago: "16 al 19 de marzo", apertura: "25 de marzo de 2026" },
  { fechaPago: "20 al 22 de marzo", apertura: "26 de marzo de 2026" },
  { fechaPago: "23 al 24 de marzo", apertura: "27 de marzo de 2026" },
  { fechaPago: "25 al 27 de marzo", apertura: "28 de marzo de 2026" },
  { fechaPago: "28 al 31 de marzo", apertura: "01 de abril de 2026" },
];

/* ── Montos ── */
const montos = [
  { concepto: "Matrícula Regular (FCS y FICA)", monto: "S/ 250.00" },
  { concepto: "Matrícula Regular (Medicina Humana)", monto: "S/ 280.00" },
  { concepto: "Carné Universitario (todos)", monto: "S/ 17.70" },
  { concepto: "Recargo Extemporáneo", monto: "S/ 70.00 adicional" },
];

/* ── Resumen acordeón ── */
const sections = [
  {
    number: "1",
    title: "Objetivos",
    content:
      "Definir el procedimiento y las disposiciones que regulan el proceso de matrícula de los estudiantes de pregrado, garantizando su ejecución ordenada, transparente y conforme a la normativa institucional y legal vigente.",
  },
  {
    number: "2",
    title: "Finalidad",
    content:
      "Asegurar que el proceso de matrícula se desarrolle con eficiencia, equidad y trazabilidad, en concordancia con el Reglamento de Estudios, el Reglamento General y el Estatuto de la Universidad Autónoma de Ica.",
  },
  {
    number: "4",
    title: "Alcance",
    content:
      "La presente directiva es de aplicación obligatoria para los estudiantes de pregrado de la Universidad Autónoma de Ica en todas sus Facultades y Escuelas Profesionales, así como para el personal administrativo y académico que interviene en el proceso de matrícula.",
  },
  {
    number: "6",
    title: "Normas Generales — Modalidades de Matrícula",
    content: "",
    subsections: [
      { label: "a. Matrícula Regular", text: "Mínimo 12 créditos y máximo 23, dentro del período del calendario académico." },
      { label: "b. Matrícula Especial", text: "Carga académica menor de 12 créditos." },
      { label: "c. Matrícula Excepcional", text: "Modalidad excepcional según normativa vigente." },
      { label: "d. Matrícula Libre", text: "Para estudiantes de intercambio o visitantes, sin carga académica registrada." },
    ],
  },
];

function AccordionItem({
  number, title, content, subsections,
}: {
  number: string; title: string; content: string; subsections?: { label: string; text: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-muted/30 transition-colors text-left"
      >
        <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <span className="flex-1 font-semibold text-foreground">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 bg-white space-y-3">
              {content && <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>}
              {subsections?.map((s) => (
                <div key={s.label} className="pl-4 border-l-2 border-primary/20">
                  <p className="text-sm font-semibold text-foreground mb-0.5">{s.label}</p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{label}</h2>
    </div>
  );
}

export default function DirectivaMatricula() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Documento Oficial
            </span>
          </div>
          <h1 className="text-2xl font-bold text-primary leading-tight">
            Directiva del Proceso de Matrícula
          </h1>
          <p className="text-muted-foreground mt-1">Pregrado 2026-1 · Universidad Autónoma de Ica</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Ver PDF
            </Button>
          </a>
          <a href={pdfUrl} download="Directiva-Matricula-2026-1-UAI.pdf">
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
              <Download className="w-4 h-4" />
              Descargar
            </Button>
          </a>
        </div>
      </div>

      {/* ── PDF Viewer ── */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            DIRECTIVA_DEL_PROCESO_DE_MATRICULA_PREGRADO_2026-1.pdf
          </span>
          <a
            href={pdfUrl}
            download="Directiva-Matricula-2026-1-UAI.pdf"
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar
          </a>
        </div>
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=0`}
          className="w-full"
          style={{ height: "520px" }}
          title="Directiva de Matrícula 2026-1"
        />
      </div>

      {/* ══════════════════════════════════════════
          INICIO DE CLASES 2026-1
      ══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Sub-header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3" style={{ background: "hsl(218,75%,32%)" }}>
          <CalendarDays className="w-5 h-5 text-white" />
          <h2 className="text-base font-bold text-white tracking-wide uppercase">
            Inicio de Clases 2026-1
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Tabla de actividades */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "hsl(218,75%,32%)" }}>
                  <th className="text-left px-4 py-3 text-white font-bold uppercase tracking-wide rounded-tl-lg">
                    Actividad
                  </th>
                  <th className="text-left px-4 py-3 text-white font-bold uppercase tracking-wide rounded-tr-lg">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {calendarioActividades.map((row, i) => (
                  <tr
                    key={i}
                    className={row.highlight ? "font-bold" : ""}
                    style={
                      row.highlight
                        ? { background: "hsl(199,80%,88%)", color: "hsl(218,75%,25%)" }
                        : { background: i % 2 === 0 ? "hsl(215 30% 97%)" : "white" }
                    }
                  >
                    <td className="px-4 py-3 border-b border-border/30">{row.actividad}</td>
                    <td className={`px-4 py-3 border-b border-border/30 ${row.highlight ? "font-extrabold" : "text-primary font-medium"}`}>
                      {row.fecha}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rol de evaluaciones */}
          <div>
            <div className="px-4 py-2 rounded-t-lg font-bold text-white text-sm uppercase tracking-wide" style={{ background: "hsl(218,75%,32%)" }}>
              Rol de Evaluaciones
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rolEvaluaciones.map((row, i) => (
                  <tr
                    key={i}
                    className={row.highlight ? "font-bold" : ""}
                    style={
                      row.highlight
                        ? { background: "hsl(218,75%,32%)", color: "white" }
                        : { background: i % 2 === 0 ? "hsl(215 30% 97%)" : "white" }
                    }
                  >
                    <td className="px-4 py-3 border-b border-border/30">{row.actividad}</td>
                    <td className={`px-4 py-3 border-b border-border/30 font-medium ${row.highlight ? "" : "text-primary"}`}>
                      {row.fecha}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Cuotas + Cronograma matrícula ── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Cronograma de Cuotas */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3" style={{ background: "hsl(218,75%,32%)" }}>
            <CreditCard className="w-4 h-4 text-white" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">
              Cronograma de Cuotas 2026-1
            </h3>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <tbody>
                {cuotas.map((c, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "hsl(199,80%,93%)" : "white" }}>
                    <td className="px-4 py-3 border-b border-border/30 font-bold text-primary uppercase">
                      {c.numero}
                    </td>
                    <td className="px-4 py-3 border-b border-border/30 text-foreground font-medium">
                      {c.fecha}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cronograma apertura ficha */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3" style={{ background: "hsl(218,75%,32%)" }}>
            <CalendarDays className="w-4 h-4 text-white" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">
              Apertura Ficha de Matrícula
            </h3>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-muted-foreground font-semibold">Fecha de Pago</th>
                  <th className="text-left pb-2 text-muted-foreground font-semibold">Apertura Ficha</th>
                </tr>
              </thead>
              <tbody>
                {cronograma.map((c, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 text-foreground">{c.fechaPago}</td>
                    <td className="py-2.5 text-primary font-medium">{c.apertura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>Bancos habilitados:</strong> Scotiabank, BBVA, BCP y Caja Municipal Ica.
            </div>
          </div>
        </div>
      </div>

      {/* Montos */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
        <SectionHeader icon={CreditCard} label="Montos de Pago 2026-1" />
        <div className="space-y-2">
          {montos.map((m, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
              <span className="text-sm text-muted-foreground">{m.concepto}</span>
              <span className="text-sm font-bold text-primary">{m.monto}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen acordeón */}
      <div>
        <SectionHeader icon={FileText} label="Resumen de la Directiva" />
        <div className="space-y-3">
          {sections.map((s) => (
            <AccordionItem key={s.number} {...s} />
          ))}
        </div>
      </div>

    </div>
  );
}
