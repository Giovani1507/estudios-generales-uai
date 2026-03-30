import { useEffect, useState, useMemo } from "react";
import { exportExcelWithLogo } from "@/lib/excel-export";
import {
  CheckCircle2, AlertTriangle, XCircle, Users, Search,
  Download, Info, Shield, ClipboardCheck, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocPlan {
  dni: number;
  nombre: string;
  programa: string;
  enDatosGenerales?: boolean;
}

interface DocReg {
  dni: number;
  nombre: string;
  programa: string;
}

interface DocAmbos {
  dni: number;
  nombre: string;
  programa: string;
  registroNombre: string;
}

interface VerifData {
  totalEnPlan?: number;
  totalEnRegistro?: number;
  totalMatch?: number;
  match?: number;
  // Puede venir como número (resumen) o como array (lista)
  enPlanNoRegistro?: DocPlan[] | number;
  enRegistroNoPlan?: DocReg[] | number;
  enAmbos?: DocAmbos[] | number;
  // Alias antiguo por compatibilidad
  enRegistroSinPlan?: DocReg[] | number;
  resumen?: {
    totalEnPlanificacion?: number;
    totalEnRegistro?: number;
    enAmbos?: number;
    enPlanNoRegistro?: number;
    enRegistroSinPlan?: number;
  };
}

function asArray<T>(v: T[] | number | undefined): T[] {
  if (Array.isArray(v)) return v;
  return [];
}

type Tab = "resumen" | "faltantes" | "sinCurso" | "completos";

export default function VerificacionFICA() {
  const [data, setData]       = useState<VerifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>("resumen");
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/verificacion-fica-2026-1.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredFaltantes = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return asArray<DocPlan>(data.enPlanNoRegistro).filter(
      (d) => d.nombre.toLowerCase().includes(q) || d.dni.toString().includes(q)
    );
  }, [data, search]);

  const filteredSinCurso = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    const list = asArray<DocReg>(data.enRegistroNoPlan ?? data.enRegistroSinPlan);
    return list.filter(
      (d) => d.nombre.toLowerCase().includes(q) || d.dni.toString().includes(q)
    );
  }, [data, search]);

  const filteredCompletos = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return asArray<DocAmbos>(data.enAmbos).filter(
      (d) => d.nombre.toLowerCase().includes(q) || d.dni.toString().includes(q)
    );
  }, [data, search]);

  const exportExcel = (list: (DocPlan | DocReg | DocAmbos)[], filename: string, title: string) => {
    exportExcelWithLogo({
      sheetTitle: title,
      institution: "Universidad Autónoma de Ica",
      subtitle: "Verificación FICA · Semestre 2026-1",
      fileName: filename.replace(".xlsx", ""),
      columns: [
        { header: "#",       key: "n",       width: 5,  align: "center" },
        { header: "DNI",     key: "dni",     width: 13, align: "center" },
        { header: "Nombre",  key: "nombre",  width: 46 },
        { header: "Programa",key: "programa",width: 38 },
      ],
      rows: list.map((d, i) => ({ n: i + 1, dni: d.dni ?? "—", nombre: d.nombre, programa: d.programa })),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Shield className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
          <p className="text-sm">Cargando verificación…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <p className="text-sm">No se pudo cargar el archivo de verificación.</p>
      </div>
    );
  }

  // Normaliza el JSON antiguo (resumen anidado) y el nuevo (campos en raíz)
  const resumen = data.resumen ?? {
    totalEnPlanificacion: data.totalEnPlan ?? 0,
    totalEnRegistro:      data.totalEnRegistro ?? 0,
    enAmbos:              typeof data.enAmbos === "number" ? data.enAmbos : (data.totalMatch ?? 0),
    enPlanNoRegistro:     typeof data.enPlanNoRegistro === "number" ? data.enPlanNoRegistro : 0,
    enRegistroSinPlan:    typeof data.enRegistroNoPlan === "number" ? data.enRegistroNoPlan
                          : typeof data.enRegistroSinPlan === "number" ? data.enRegistroSinPlan : 0,
  };

  const allOk = (resumen.enPlanNoRegistro ?? 0) === 0;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "resumen",    label: "Resumen",                  count: -1 },
    { id: "faltantes",  label: "Faltantes en Registro",    count: resumen.enPlanNoRegistro ?? 0 },
    { id: "sinCurso",   label: "Sin Cursos Asignados",      count: resumen.enRegistroSinPlan ?? 0 },
    { id: "completos",  label: "Verificados",               count: resumen.enAmbos ?? 0 },
  ];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Verificación Docentes FICA 2026-1
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cruce entre la Planificación FICA 2026-1 y el Registro Oficial de Docentes
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Generado:</p>
          <p className="text-xs font-medium text-foreground">
            {new Date(data.generado).toLocaleString("es-PE")}
          </p>
        </div>
      </div>

      {/* Status banner */}
      {allOk ? (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
          <div>
            <p className="text-base font-bold text-green-800">
              ✅ Todos los docentes FICA de la planificación están en el registro
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              Los {resumen.enAmbos} docentes asignados a cursos FICA 2026-1 tienen registro activo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <XCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="text-base font-bold text-red-800">
              ⚠️ Hay {resumen.enPlanNoRegistro} docentes en la planificación sin registro
            </p>
            <p className="text-sm text-red-700 mt-0.5">
              Estos docentes están asignados a cursos FICA pero no aparecen en el Registro de Docentes.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En Planificación",   value: resumen.totalEnPlanificacion, icon: <ClipboardCheck className="w-4 h-4" />, color: "text-blue-600 bg-blue-50"   },
          { label: "En Registro FICA",   value: resumen.totalEnRegistro,       icon: <Users className="w-4 h-4" />,          color: "text-indigo-600 bg-indigo-50" },
          { label: "Verificados",        value: resumen.enAmbos,               icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-green-600 bg-green-50"   },
          { label: "Sin Cursos Asign.",  value: resumen.enRegistroSinPlan,     icon: <AlertTriangle className="w-4 h-4" />,  color: "text-amber-600 bg-amber-50"   },
          { label: "Faltantes",          value: resumen.enPlanNoRegistro,      icon: <XCircle className="w-4 h-4" />,        color: resumen.enPlanNoRegistro > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50" },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>{c.icon}</div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className="text-xl font-bold text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
            {t.count >= 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                t.id === "faltantes" && t.count > 0
                  ? "bg-red-100 text-red-700"
                  : t.id === "sinCurso"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Resumen tab ── */}
      {tab === "resumen" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border/40 bg-white space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> Metodología de verificación
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li><strong className="text-foreground">Planificación FICA 2026-1</strong>: {resumen.totalEnPlanificacion} docentes únicos asignados a cursos con código de facultad FICA en la planificación oficial 2026-1.</li>
              <li><strong className="text-foreground">Registro de Docentes FICA</strong>: {resumen.totalEnRegistro} docentes registrados con carga académica previa o actual en FICA.</li>
              <li>La comparación se realiza por <strong className="text-foreground">número de DNI</strong> para máxima precisión.</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{resumen.enAmbos}</p>
              <p className="text-sm text-green-600 font-medium">Docentes verificados</p>
              <p className="text-xs text-green-500 mt-1">En plan y en registro ✓</p>
            </div>
            <div className={`p-4 rounded-xl text-center ${resumen.enPlanNoRegistro > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              {resumen.enPlanNoRegistro > 0
                ? <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                : <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />}
              <p className={`text-2xl font-bold ${resumen.enPlanNoRegistro > 0 ? "text-red-700" : "text-green-700"}`}>{resumen.enPlanNoRegistro}</p>
              <p className={`text-sm font-medium ${resumen.enPlanNoRegistro > 0 ? "text-red-600" : "text-green-600"}`}>Faltantes en registro</p>
              <p className={`text-xs mt-1 ${resumen.enPlanNoRegistro > 0 ? "text-red-500" : "text-green-500"}`}>
                {resumen.enPlanNoRegistro > 0 ? "En plan pero sin registro ⚠️" : "Ninguno falta ✓"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-700">{resumen.enRegistroSinPlan}</p>
              <p className="text-sm text-amber-600 font-medium">Sin cursos asignados</p>
              <p className="text-xs text-amber-500 mt-1">En registro pero sin plan</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Faltantes tab ── */}
      {tab === "faltantes" && (
        <div className="space-y-3">
          {resumen.enPlanNoRegistro === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-green-600">
              <CheckCircle2 className="w-16 h-16 opacity-70" />
              <p className="text-lg font-semibold">¡No hay docentes faltantes!</p>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Todos los docentes asignados a cursos FICA en la planificación 2026-1 están presentes en el Registro de Docentes.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                  {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <Button onClick={() => exportExcel(filteredFaltantes, "faltantes_fica_2026-1.xlsx", "Docentes Faltantes FICA 2026-1")} className="gap-2 h-9 text-sm bg-red-600 hover:bg-red-700">
                  <Download className="w-4 h-4" /> Exportar
                </Button>
              </div>
              <TableList rows={filteredFaltantes} badge="danger" />
            </>
          )}
        </div>
      )}

      {/* ── Sin curso tab ── */}
      {tab === "sinCurso" && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2 text-sm text-amber-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Estos {resumen.enRegistroSinPlan} docentes están en el Registro de Docentes FICA pero no tienen ningún curso asignado en la Planificación 2026-1.</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <Button onClick={() => exportExcel(filteredSinCurso, "sin_cursos_fica_2026-1.xlsx", "Docentes Sin Cursos FICA 2026-1")} variant="outline" className="gap-2 h-9 text-sm">
              <Download className="w-4 h-4" /> Exportar
            </Button>
          </div>
          <TableList rows={filteredSinCurso} badge="warning" />
        </div>
      )}

      {/* ── Completos tab ── */}
      {tab === "completos" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <Button onClick={() => exportExcel(filteredCompletos, "verificados_fica_2026-1.xlsx", "Docentes Verificados FICA 2026-1")} className="gap-2 h-9 text-sm bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" /> Exportar
            </Button>
          </div>
          <TableList rows={filteredCompletos} badge="ok" />
        </div>
      )}
    </div>
  );
}

/* ── Shared table component ── */
function TableList({ rows, badge }: { rows: { dni: number; nombre: string; programa: string }[]; badge: "ok" | "warning" | "danger" }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Search className="w-7 h-7 opacity-30" />
        <p className="text-sm">Sin resultados</p>
      </div>
    );
  }

  const badgeCls =
    badge === "ok"      ? "border-green-200 text-green-700 bg-green-50" :
    badge === "warning" ? "border-amber-200 text-amber-700 bg-amber-50" :
                          "border-red-200 text-red-700 bg-red-50";
  const badgeLabel =
    badge === "ok"      ? "Verificado" :
    badge === "warning" ? "Sin cursos" :
                          "Faltante";

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
      <div className="grid grid-cols-[44px_112px_1fr_auto] bg-muted/60 border-b border-border/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>#</span><span>DNI</span><span>Nombre del Docente</span><span>Estado</span>
      </div>
      <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
        {rows.map((d, i) => (
          <div key={d.dni} className="grid grid-cols-[44px_112px_1fr_auto] items-center px-4 py-2.5 hover:bg-muted/20 transition-colors">
            <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
            <span className="text-sm font-mono text-foreground">{d.dni}</span>
            <div className="pr-3">
              <p className="text-sm font-medium text-foreground">{d.nombre}</p>
              {d.programa && <p className="text-[11px] text-muted-foreground truncate">{d.programa}</p>}
            </div>
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${badgeCls}`}>
              {badgeLabel}
            </Badge>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40">
        <span className="text-xs text-muted-foreground">{rows.length} docentes</span>
      </div>
    </div>
  );
}
