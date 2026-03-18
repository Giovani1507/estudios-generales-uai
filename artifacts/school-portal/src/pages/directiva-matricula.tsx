import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const pdfUrl = `${import.meta.env.BASE_URL}directiva-matricula-2026-1.pdf`;

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
      {
        label: "a. Matrícula Regular",
        text: "Comprende a los estudiantes que se inscriben en un mínimo de 12 créditos y un máximo de 23. Su matrícula será dentro del periodo establecido en el calendario académico, antes del inicio oficial de clases.",
      },
      {
        label: "b. Matrícula Especial",
        text: "Comprende a los estudiantes que registran una carga académica menor de 12 créditos.",
      },
      {
        label: "c. Matrícula Excepcional",
        text: "Modalidad excepcional según normativa vigente.",
      },
      {
        label: "d. Matrícula Libre",
        text: "Permite a estudiantes de intercambio estudiantil o visitantes matricularse sin registrar carga académica.",
      },
    ],
  },
];

const cronograma = [
  { fechaPago: "16 al 19 de marzo", apertura: "25 de marzo de 2026" },
  { fechaPago: "20 al 22 de marzo", apertura: "26 de marzo de 2026" },
  { fechaPago: "23 al 24 de marzo", apertura: "27 de marzo de 2026" },
  { fechaPago: "25 al 27 de marzo", apertura: "28 de marzo de 2026" },
  { fechaPago: "28 al 31 de marzo", apertura: "01 de abril de 2026" },
];

const montos = [
  { concepto: "Matrícula Regular (FCS y FICA)", monto: "S/ 250.00" },
  { concepto: "Matrícula Regular (Medicina Humana)", monto: "S/ 280.00" },
  { concepto: "Carné Universitario (todos)", monto: "S/ 17.70" },
  { concepto: "Recargo Extemporáneo", monto: "S/ 70.00 adicional" },
];

function AccordionItem({
  number,
  title,
  content,
  subsections,
}: {
  number: string;
  title: string;
  content: string;
  subsections?: { label: string; text: string }[];
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
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
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

export default function DirectivaMatricula() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
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
          <p className="text-muted-foreground mt-1">
            Pregrado 2026-1 · Universidad Autónoma de Ica
          </p>
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

      {/* PDF Viewer */}
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

      {/* Resumen de contenido */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Resumen de la Directiva</h2>
        <div className="space-y-3">
          {sections.map((s) => (
            <AccordionItem key={s.number} {...s} />
          ))}
        </div>
      </div>

      {/* Cronograma */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            Cronograma Matrícula Regular
          </h3>
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
                  <td className="py-2 text-foreground">{c.fechaPago}</td>
                  <td className="py-2 text-primary font-medium">{c.apertura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            Montos de Pago 2026-1
          </h3>
          <div className="space-y-3">
            {montos.map((m, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{m.concepto}</span>
                <span className="text-sm font-bold text-primary">{m.monto}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>Bancos habilitados:</strong> Scotiabank, BBVA, BCP y Caja Municipal Ica.
          </div>
        </div>
      </div>
    </div>
  );
}
