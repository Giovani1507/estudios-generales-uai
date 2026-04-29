import { useEffect, useMemo, useRef, useState } from "react";
import { useLogPageEntry } from "@/hooks/use-activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Upload, Download, Loader2, Trash2, Save, Plus, RefreshCw, FileSpreadsheet, ChevronLeft,
} from "lucide-react";
import { parseNominaPdf, buildGrupos, type NominaGrupo } from "@/lib/parse-nomina-pdf";
import { exportNominaXlsx } from "@/lib/export-nomina-excel";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type NominaListItem = {
  id: number;
  periodo: string;
  codigoCarrera: string;
  carrera: string;
  estado: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type NominaFull = NominaListItem & {
  data: { grupos: NominaGrupo[] };
};

function recalcParents(grupos: NominaGrupo[]): NominaGrupo[] {
  return grupos.map(g => {
    const matriculados = g.cursos.length
      ? Math.max(...g.cursos.map(c => c.matriculados))
      : g.matriculados;
    const retOctda    = Math.max(0, ...g.cursos.map(c => c.retOctda));
    const retInasist  = Math.max(0, ...g.cursos.map(c => c.retInasist));
    const totalActivos = Math.max(0, matriculados - retOctda - retInasist);
    const cursosWithTotal = g.cursos.map(c => ({
      ...c,
      totalActivos: Math.max(0, (c.matriculados || 0) - (c.retOctda || 0) - (c.retInasist || 0)),
    }));
    return { ...g, matriculados, retOctda, retInasist, totalActivos, cursos: cursosWithTotal };
  });
}

export default function NominaPage() {
  useLogPageEntry("Nómina");

  const [list, setList] = useState<NominaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<NominaFull | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load list
  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch(`${apiBase}/api/nominas`, { credentials: "include" });
      if (res.ok) setList(await res.json());
    } finally {
      setLoadingList(false);
    }
  }
  useEffect(() => { loadList(); }, []);

  // Load full nómina
  async function openNomina(id: number) {
    setError(null);
    const res = await fetch(`${apiBase}/api/nominas/${id}`, { credentials: "include" });
    if (!res.ok) {
      setError("No se pudo cargar la nómina");
      return;
    }
    const full: NominaFull = await res.json();
    setEditing(full);
  }

  // Upload PDF and start a new nómina draft
  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseNominaPdf(file);
      if (!parsed.carrera || !parsed.periodo) {
        setError("No se pudo leer carrera o periodo del PDF. Verifica el archivo.");
        setParsing(false);
        return;
      }
      const grupos = buildGrupos(parsed);
      if (grupos.length === 0) {
        setError("El PDF no contiene cursos de ciclo 1 ni 2.");
        setParsing(false);
        return;
      }
      setEditing({
        id: 0, // not saved yet
        periodo: parsed.periodo,
        codigoCarrera: parsed.codigoCarrera,
        carrera: parsed.carrera,
        estado: "BORRADOR",
        createdByName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { grupos },
      });
    } catch (e: any) {
      console.error(e);
      setError("Error al leer el PDF: " + (e?.message || "desconocido"));
    } finally {
      setParsing(false);
    }
  }

  // Persist (create or update)
  async function saveNomina() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const fixed = recalcParents(editing.data.grupos);
      const payload = {
        periodo: editing.periodo,
        codigoCarrera: editing.codigoCarrera,
        carrera: editing.carrera,
        data: { grupos: fixed },
        estado: editing.estado,
      };
      const url = editing.id ? `${apiBase}/api/nominas/${editing.id}` : `${apiBase}/api/nominas`;
      const method = editing.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Error al guardar");
        return;
      }
      const saved: NominaFull = await res.json();
      setEditing({ ...saved, data: { grupos: fixed } });
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function deleteNomina(id: number) {
    if (!confirm("¿Eliminar esta nómina? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`${apiBase}/api/nominas/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      if (editing?.id === id) setEditing(null);
      await loadList();
    }
  }

  function exportExcel() {
    if (!editing) return;
    const fixed = recalcParents(editing.data.grupos);
    exportNominaXlsx(editing.carrera, editing.periodo, fixed);
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <NominaEditor
        nomina={editing}
        setNomina={setEditing}
        onBack={() => { setEditing(null); setError(null); }}
        onSave={saveNomina}
        onExport={exportExcel}
        saving={saving}
        error={error}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-7 h-7 text-blue-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nómina</h1>
          <p className="text-sm text-muted-foreground">
            Sube el reporte PDF de matriculados de una carrera y arma la nómina de Ciclo 1 y 2 automáticamente.
          </p>
        </div>
      </div>

      {/* Uploader */}
      <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Nueva nómina desde PDF</p>
              <p className="text-xs text-muted-foreground">
                Reporte de Matriculados por Curso (PDF). Solo se procesan los ciclos 1 y 2.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {parsing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando…</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Subir PDF</>
              )}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Saved nóminas */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Nóminas guardadas</h2>
            <p className="text-xs text-muted-foreground">{list.length} registradas</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadList} disabled={loadingList}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingList ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {loadingList ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Aún no has creado ninguna nómina. Sube un PDF para empezar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Carrera</th>
                <th className="text-left px-4 py-2 font-semibold">Periodo</th>
                <th className="text-left px-4 py-2 font-semibold">Estado</th>
                <th className="text-left px-4 py-2 font-semibold">Creado por</th>
                <th className="text-left px-4 py-2 font-semibold">Actualizado</th>
                <th className="text-right px-4 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map(n => (
                <tr key={n.id} className="border-t border-slate-100 hover:bg-blue-50/40 transition">
                  <td className="px-4 py-2 font-medium text-slate-800">{n.carrera}</td>
                  <td className="px-4 py-2">{n.periodo}</td>
                  <td className="px-4 py-2">
                    <Badge variant={n.estado === "FINAL" ? "default" : "secondary"}>{n.estado}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{n.createdByName || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(n.updatedAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openNomina(n.id)}>Abrir</Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteNomina(n.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────
function NominaEditor({
  nomina, setNomina, onBack, onSave, onExport, saving, error,
}: {
  nomina: NominaFull;
  setNomina: (n: NominaFull) => void;
  onBack: () => void;
  onSave: () => void;
  onExport: () => void;
  saving: boolean;
  error: string | null;
}) {
  const grupos = nomina.data.grupos;

  function updateCurso(gIdx: number, cIdx: number, field: "matriculados" | "retOctda" | "retInasist", val: number) {
    const next = [...grupos];
    const g = { ...next[gIdx], cursos: [...next[gIdx].cursos] };
    g.cursos[cIdx] = { ...g.cursos[cIdx], [field]: Math.max(0, val || 0) };
    g.cursos[cIdx].totalActivos = Math.max(0,
      (g.cursos[cIdx].matriculados || 0) - (g.cursos[cIdx].retOctda || 0) - (g.cursos[cIdx].retInasist || 0)
    );
    // recompute parent
    g.matriculados = Math.max(...g.cursos.map(c => c.matriculados));
    g.retOctda    = Math.max(...g.cursos.map(c => c.retOctda));
    g.retInasist  = Math.max(...g.cursos.map(c => c.retInasist));
    g.totalActivos = Math.max(0, g.matriculados - g.retOctda - g.retInasist);
    next[gIdx] = g;
    setNomina({ ...nomina, data: { grupos: next } });
  }

  function updateGrupoMeta(gIdx: number, field: "turno" | "local" | "modalidad" | "seccion", val: string) {
    const next = [...grupos];
    next[gIdx] = { ...next[gIdx], [field]: val } as NominaGrupo;
    setNomina({ ...nomina, data: { grupos: next } });
  }

  // Group by ciclo for rendering
  const byCiclo = useMemo(() => ({
    1: grupos.map((g, i) => ({ g, i })).filter(x => x.g.ciclo === 1),
    2: grupos.map((g, i) => ({ g, i })).filter(x => x.g.ciclo === 2),
  }), [grupos]);

  const totals = useMemo(() => ({
    1: byCiclo[1].reduce((s, x) => s + x.g.matriculados, 0),
    2: byCiclo[2].reduce((s, x) => s + x.g.matriculados, 0),
    activos1: byCiclo[1].reduce((s, x) => s + x.g.totalActivos, 0),
    activos2: byCiclo[2].reduce((s, x) => s + x.g.totalActivos, 0),
  }), [byCiclo]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{nomina.carrera}</h1>
            <p className="text-xs text-muted-foreground">
              Periodo {nomina.periodo} · {nomina.codigoCarrera} · {grupos.length} secciones
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={nomina.estado} onValueChange={v => setNomina({ ...nomina, estado: v })}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BORRADOR">Borrador</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Matric. Ciclo 1"  value={totals[1]}        color="bg-blue-50 border-blue-200 text-blue-700" />
        <KPI label="Activos Ciclo 1"  value={totals.activos1}  color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KPI label="Matric. Ciclo 2"  value={totals[2]}        color="bg-indigo-50 border-indigo-200 text-indigo-700" />
        <KPI label="Activos Ciclo 2"  value={totals.activos2}  color="bg-teal-50 border-teal-200 text-teal-700" />
      </div>

      {/* Per-ciclo tables */}
      {[1, 2].map(c => {
        const items = byCiclo[c as 1 | 2];
        if (items.length === 0) return (
          <div key={c} className="bg-white border border-slate-200 rounded-xl p-6 text-center text-muted-foreground">
            No hay secciones en el Ciclo {c}.
          </div>
        );
        return (
          <div key={c} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-blue-700 to-blue-600 text-white font-semibold">
              CICLO {c}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Carrera / Curso</th>
                    <th className="px-2 py-2">Modalidad</th>
                    <th className="px-2 py-2">Local</th>
                    <th className="px-2 py-2">Sección</th>
                    <th className="px-2 py-2">Turno</th>
                    <th className="px-2 py-2 w-24">Matric.</th>
                    <th className="px-2 py-2 w-24">Ret. OCTDA</th>
                    <th className="px-2 py-2 w-24">Ret. Inasist.</th>
                    <th className="px-2 py-2 w-24">Activos</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ g, i }) => (
                    <GrupoRows
                      key={i}
                      g={g}
                      gIdx={i}
                      updateCurso={updateCurso}
                      updateMeta={updateGrupoMeta}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GrupoRows({
  g, gIdx, updateCurso, updateMeta,
}: {
  g: NominaGrupo;
  gIdx: number;
  updateCurso: (gIdx: number, cIdx: number, field: "matriculados" | "retOctda" | "retInasist", val: number) => void;
  updateMeta: (gIdx: number, field: "turno" | "local" | "modalidad" | "seccion", val: string) => void;
}) {
  return (
    <>
      <tr className="bg-blue-50/60 border-t border-slate-200 font-semibold text-slate-800">
        <td className="px-3 py-2">{g.carrera}</td>
        <td className="px-2 py-2 text-center">
          <Select value={g.modalidad} onValueChange={v => updateMeta(gIdx, "modalidad", v)}>
            <SelectTrigger className="h-7 px-2 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PRESENCIAL">PRESENCIAL</SelectItem>
              <SelectItem value="VIRTUAL">VIRTUAL</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2 text-center">
          <Select value={g.local} onValueChange={v => updateMeta(gIdx, "local", v)}>
            <SelectTrigger className="h-7 px-2 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HUACHO">HUACHO</SelectItem>
              <SelectItem value="SEDE">SEDE</SelectItem>
              <SelectItem value="FILIAL">FILIAL</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2 text-center">
          <Input
            value={g.seccion}
            onChange={e => updateMeta(gIdx, "seccion", e.target.value.toUpperCase().slice(0, 4))}
            className="h-7 text-xs text-center"
          />
        </td>
        <td className="px-2 py-2 text-center">
          <Select value={g.turno || ""} onValueChange={v => updateMeta(gIdx, "turno", v)}>
            <SelectTrigger className="h-7 px-2 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DIURNO">DIURNO</SelectItem>
              <SelectItem value="NOCTURNO">NOCTURNO</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2 text-center font-bold">{g.matriculados}</td>
        <td className="px-2 py-2 text-center font-bold">{g.retOctda}</td>
        <td className="px-2 py-2 text-center font-bold">{g.retInasist}</td>
        <td className="px-2 py-2 text-center font-bold text-emerald-700">{g.totalActivos}</td>
      </tr>
      {g.cursos.map((c, cIdx) => (
        <tr key={cIdx} className="border-t border-slate-100 hover:bg-slate-50/60">
          <td className="pl-8 pr-3 py-1.5 text-slate-700">{c.nombre}</td>
          <td colSpan={3} className="px-2 py-1.5 text-center text-xs text-muted-foreground">{c.seccion}</td>
          <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">{c.codigo}</td>
          <td className="px-1 py-1.5">
            <NumInput value={c.matriculados} onChange={v => updateCurso(gIdx, cIdx, "matriculados", v)} />
          </td>
          <td className="px-1 py-1.5">
            <NumInput value={c.retOctda} onChange={v => updateCurso(gIdx, cIdx, "retOctda", v)} />
          </td>
          <td className="px-1 py-1.5">
            <NumInput value={c.retInasist} onChange={v => updateCurso(gIdx, cIdx, "retInasist", v)} />
          </td>
          <td className="px-2 py-1.5 text-center text-emerald-700 font-medium">{c.totalActivos}</td>
        </tr>
      ))}
    </>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      className="h-7 text-xs text-center px-1"
    />
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
