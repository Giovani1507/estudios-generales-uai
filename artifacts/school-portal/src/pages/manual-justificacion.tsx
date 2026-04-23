import { useEffect } from "react";
import {
  BookOpen, LogIn, LayoutGrid, GraduationCap, FileCheck2, AlertCircle, Printer,
  ArrowRight, Mail, Globe, ExternalLink,
} from "lucide-react";

const CAMPUS_URL = "https://campusvirtual.autonomadeica.edu.pe/";

export default function ManualJustificacion() {
  useEffect(() => {
    document.title = "Manual de Justificación · UAI";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 print:bg-white">
      {/* Encabezado */}
      <header className="bg-gradient-to-r from-[#001f5f] to-[#003a8c] text-white shadow-md print:shadow-none">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center backdrop-blur">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-blue-200">Universidad Autónoma de Ica</p>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">Manual de Justificación</h1>
            <p className="text-sm text-blue-100">Plataforma Akademic · Intranet</p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden md:inline-flex items-center gap-2 bg-white text-[#001f5f] hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold print:hidden"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8 print:py-4 print:space-y-6">
        {/* Resumen */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:shadow-none print:border-slate-300">
          <h2 className="text-lg font-bold text-[#001f5f] flex items-center gap-2 mb-3">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            ¿Para qué sirve este manual?
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Esta guía está dirigida a <b>estudiantes</b> que necesitan enviar una <b>solicitud de justificación de
            inasistencia</b> a través del campus virtual <b>Akademic</b>. Sigue los pasos en orden y prepara tus
            evidencias (certificado médico, papeleta, foto, etc.) en formato <b>PDF</b> o imagen antes de empezar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-blue-700 font-bold">Dirigido a</div>
              <div className="text-sm font-semibold text-[#001f5f]">Estudiantes UAI</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">Plataforma</div>
              <div className="text-sm font-semibold text-emerald-800">Akademic · Intranet</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-amber-700 font-bold">Tiempo estimado</div>
              <div className="text-sm font-semibold text-amber-800">5 minutos</div>
            </div>
          </div>
        </section>

        {/* 1. Acceso */}
        <Section
          number="1"
          title="Acceso al campus virtual"
          icon={<LogIn className="h-5 w-5" />}
          color="blue"
        >
          <p>
            Ingresa al campus virtual desde el siguiente enlace:
          </p>
          <a
            href={CAMPUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 print:bg-white print:text-blue-700 print:border print:border-blue-300"
          >
            <Globe className="h-4 w-4" />
            campusvirtual.autonomadeica.edu.pe
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <CampoInfo label="Usuario" valor="Tu CÓDIGO de estudiante" />
            <CampoInfo label="Contraseña" valor="Tu DNI (o la que cambiaste)" />
          </div>

          <Aviso>
            Si ya cambiaste tu contraseña al ingresar por primera vez, usa la nueva. Si no recuerdas tu contraseña,
            comunícate con la oficina de soporte académico.
          </Aviso>
        </Section>

        {/* 2. Intranet */}
        <Section
          number="2"
          title="Ingresa al Intranet"
          icon={<LayoutGrid className="h-5 w-5" />}
          color="indigo"
        >
          <p>
            Una vez dentro del campus virtual, haz clic en la opción <b>Intranet</b>. Verás los módulos del
            sistema en el menú del lado izquierdo.
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            <Paso n={1}>Inicia sesión con tu usuario y contraseña.</Paso>
            <Paso n={2}>Haz clic en <b>Intranet</b>.</Paso>
            <Paso n={3}>Ubica las opciones del menú lateral izquierdo.</Paso>
          </ol>
        </Section>

        {/* 3. Información Académica */}
        <Section
          number="3"
          title="Información Académica → Inasistencias"
          icon={<GraduationCap className="h-5 w-5" />}
          color="emerald"
        >
          <p>
            Dentro del menú lateral, abre <b>Información Académica</b>. Allí encontrarás: notas, plan de estudios,
            inasistencias y situación académica. Selecciona la opción <b>Inasistencias</b>.
          </p>

          <div className="mt-4 space-y-3">
            <Paso n={1}>
              Haz clic en <b>Inasistencias</b>. Se mostrarán todos los cursos que llevas en el semestre actual.
            </Paso>
            <Paso n={2}>
              Ubica el curso que quieres justificar. A la derecha, junto a la opción <b>"Ver detalle"</b>, aparece un
              ícono para enviar la solicitud — haz clic en él.
            </Paso>
            <Paso n={3}>
              Se abrirá una <b>ventana emergente</b> con el formulario de justificación. Completa todos los campos
              que te pidan y <b>adjunta las evidencias</b> (certificado médico, papeleta, foto, etc.) para que tu
              solicitud pueda ser validada.
            </Paso>
            <Paso n={4}>
              Cuando termines, haz clic en <b>Guardar</b> para enviar la solicitud.
            </Paso>
          </div>

          <Aviso>
            <b>Importante:</b> una vez enviada la solicitud, <b>avisa a tu docente</b> del curso para que pueda
            revisarla y aprobarla desde su propia plataforma intranet.
          </Aviso>
        </Section>

        {/* Checklist final */}
        <section className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl border-2 border-emerald-200 p-6 print:bg-white">
          <h2 className="text-lg font-bold text-[#001f5f] flex items-center gap-2 mb-3">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            Checklist antes de enviar tu solicitud
          </h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              "Tengo mi código de estudiante y contraseña a la mano.",
              "Mis evidencias están escaneadas o fotografiadas y listas para subir.",
              "Sé qué curso(s) y qué fecha(s) voy a justificar.",
              "Después de enviar, voy a avisar al docente del curso.",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shrink-0">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Soporte */}
        <section className="text-center text-xs text-slate-500 border-t pt-6 print:pt-3">
          <p className="flex items-center justify-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            ¿Tienes dudas? Acércate a la <b>Oficina de Estudios Generales</b> o escribe a tu coordinador.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Universidad Autónoma de Ica · Portal Académico</p>
        </section>
      </main>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          header { background: #001f5f !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function Section({
  number, title, icon, color, children,
}: {
  number: string; title: string; icon: React.ReactNode;
  color: "blue" | "indigo" | "emerald";
  children: React.ReactNode;
}) {
  const palette = {
    blue:    { ring: "border-blue-200",    badge: "bg-blue-600",    head: "text-blue-700"    },
    indigo:  { ring: "border-indigo-200",  badge: "bg-indigo-600",  head: "text-indigo-700"  },
    emerald: { ring: "border-emerald-200", badge: "bg-emerald-600", head: "text-emerald-700" },
  }[color];
  return (
    <section className={`bg-white rounded-2xl border ${palette.ring} shadow-sm p-6 print:shadow-none`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-10 w-10 rounded-full ${palette.badge} text-white font-bold text-lg flex items-center justify-center shrink-0`}>
          {number}
        </div>
        <div>
          <h2 className={`text-lg font-bold ${palette.head} flex items-center gap-2`}>
            {icon} {title}
          </h2>
        </div>
      </div>
      <div className="text-sm text-slate-700 leading-relaxed pl-1">{children}</div>
    </section>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <div className="mt-0.5 flex items-center gap-1 shrink-0 text-[#001f5f] font-bold">
        <span>Paso {n}</span><ArrowRight className="h-3.5 w-3.5" />
      </div>
      <span className="text-slate-700">{children}</span>
    </li>
  );
}

function CampoInfo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</div>
      <div className="text-sm font-semibold text-[#001f5f]">{valor}</div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
      <div>{children}</div>
    </div>
  );
}
