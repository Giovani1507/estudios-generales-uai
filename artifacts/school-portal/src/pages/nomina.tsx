import React, { useEffect, useRef, useState } from "react";
import { useLogPageEntry } from "@/hooks/use-activity-log";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Trash2,
  Save,
  ChevronLeft,
  Upload,
  Download,
  Layers,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  FilePlus,
} from "lucide-react";
import { parseNominaPdf, buildGrupos } from "@/lib/parse-nomina-pdf";
import { exportNominaXlsx } from "@/lib/export-nomina-excel";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

export default function NominaPage() {
  useLogPageEntry("Nómina");
  const [list, setList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorFileRef = useRef<HTMLInputElement>(null);

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch(`${apiBase}/api/nominas`, {
        credentials: "include",
      });
      if (res.ok) setList(await res.json());
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  // Procesa un PDF y lo agrega al editor (sin guardar todavía)
  const procesarPdf = async (file: File) => {
    setParsing(true);
    try {
      const reports = await parseNominaPdf(file);
      if (reports.length === 0)
        throw new Error("No se encontraron datos en el PDF.");
      const nuevosGrupos = buildGrupos(reports);
      const periodo = reports[0]?.periodo || "2026-1";

      if (editing) {
        // Agrega al editor existente
        setEditing((prev: any) => ({
          ...prev,
          data: { grupos: [...prev.data.grupos, ...nuevosGrupos] },
        }));
      } else {
        // Abre el editor con la primera carrera
        setEditing({
          id: null,
          periodo,
          carrera: `NÓMINA CONSOLIDADA ${periodo}`,
          codigoCarrera: "CONSOLIDADO",
          estado: "BORRADOR",
          data: { grupos: nuevosGrupos },
        });
      }
    } catch (e: any) {
      alert(e.message || "Error al procesar el PDF.");
    } finally {
      setParsing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await procesarPdf(file);
    }
    if (fileRef.current) fileRef.current.value = "";
    if (editorFileRef.current) editorFileRef.current.value = "";
  };

  async function saveNomina() {
    if (!editing) return;
    setSaving(true);
    try {
      const url = editing.id
        ? `${apiBase}/api/nominas/${editing.id}`
        : `${apiBase}/api/nominas`;
      const res = await fetch(url, {
        method: editing.id ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        await loadList();
        setEditing(null);
      } else {
        let msg = `Error HTTP ${res.status}`;
        try {
          const b = await res.json();
          msg = b.message || b.error || msg;
        } catch {}
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteNomina(id: number) {
    if (!confirm("¿Eliminar esta nómina?")) return;
    await fetch(`${apiBase}/api/nominas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadList();
  }

  // ── Vista del editor ────────────────────────────────────────────────────────
  if (editing) {
    const grupos = editing.data.grupos;
    const carrerasUnicas = [
      ...new Set(grupos.map((g: any) => g.carrera)),
    ] as string[];

    function updateCurso(
      gIdx: number,
      cIdx: number,
      field: string,
      val: number,
    ) {
      const next = [...grupos];
      const g = { ...next[gIdx], cursos: [...next[gIdx].cursos] };
      g.cursos[cIdx] = { ...g.cursos[cIdx], [field]: val };
      g.cursos[cIdx].totalActivos =
        (g.cursos[cIdx].matriculados || 0) -
        (g.cursos[cIdx].retOctda || 0) -
        (g.cursos[cIdx].retInasist || 0);
      g.matriculados = Math.max(...g.cursos.map((c: any) => c.matriculados));
      g.retOctda = Math.max(...g.cursos.map((c: any) => c.retOctda || 0));
      g.retInasist = Math.max(...g.cursos.map((c: any) => c.retInasist || 0));
      g.totalActivos = g.matriculados - g.retOctda - g.retInasist;
      next[gIdx] = g;
      setEditing({ ...editing, data: { grupos: next } });
    }

    const byCiclo = {
      1: grupos
        .map((g: any, i: any) => ({ g, i }))
        .filter((x: any) => x.g.ciclo === 1),
      2: grupos
        .map((g: any, i: any) => ({ g, i }))
        .filter((x: any) => x.g.ciclo === 2),
    };

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header fijo */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              className="shrink-0"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Volver
            </Button>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-blue-900 truncate">
                {editing.carrera}
              </h2>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
                Periodo {editing.periodo} · {carrerasUnicas.length} carrera
                {carrerasUnicas.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Chips de carreras cargadas */}
            <div className="hidden md:flex gap-2 flex-wrap max-w-sm">
              {carrerasUnicas.slice(0, 3).map((c: string) => (
                <span
                  key={c}
                  className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full truncate max-w-[140px]"
                >
                  {c}
                </span>
              ))}
              {carrerasUnicas.length > 3 && (
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">
                  +{carrerasUnicas.length - 3} más
                </span>
              )}
            </div>

            {/* Botón agregar carrera */}
            <Button
              onClick={() => editorFileRef.current?.click()}
              disabled={parsing}
              variant="outline"
              className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {parsing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FilePlus className="w-4 h-4 mr-2" />
              )}
              Agregar Carrera
            </Button>

            <Button
              onClick={saveNomina}
              disabled={saving}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>

            <Button
              onClick={() => exportNominaXlsx(editing.periodo, grupos)}
              className="shrink-0 bg-[#1e3a8a] hover:bg-[#162e6d]"
            >
              <Download className="w-4 h-4 mr-2" /> Descargar
            </Button>
          </div>
        </div>

        <input
          ref={editorFileRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Banner de carreras cargadas */}
        {carrerasUnicas.length > 0 && (
          <div className="bg-blue-600 text-white px-6 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest opacity-70">
                Carreras en este documento:
              </span>
              {carrerasUnicas.map((c: string) => (
                <span
                  key={c}
                  className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tablas por ciclo */}
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
          {[1, 2].map((c) => (
            <div
              key={c}
              className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight">
                      Nómina del Ciclo {c === 1 ? "I" : "II"}
                    </h3>
                    <p className="text-blue-200 text-xs mt-0.5">
                      {byCiclo[c as 1 | 2].length} grupo
                      {byCiclo[c as 1 | 2].length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-white/30 border">
                  Consolidado
                </Badge>
              </div>

              {byCiclo[c as 1 | 2].length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic text-sm">
                  No hay grupos para este ciclo. Agrega más PDFs con el botón
                  "Agregar Carrera".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100">
                        <th className="p-4 text-left w-2/5 italic">
                          Carrera / Curso Académico
                        </th>
                        <th className="p-4 text-center">Matriculados</th>
                        <th className="p-4 text-center">Ret. OCTDA</th>
                        <th className="p-4 text-center">Ret. INAS.</th>
                        <th className="p-4 text-center bg-blue-50 text-blue-700">
                          Total Activos
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {byCiclo[c as 1 | 2].map(({ g, i }: any) => (
                        <React.Fragment key={i}>
                          <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors">
                            <td className="p-4 font-black text-[#1e3a8a] text-sm uppercase">
                              {g.carrera}
                              <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-[10px] font-bold">
                                {g.seccion}
                              </span>
                              <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">
                                {g.modalidad}
                              </span>
                            </td>
                            <td className="text-center font-black text-slate-800">
                              {g.matriculados}
                            </td>
                            <td className="text-center font-bold text-slate-400">
                              {g.retOctda}
                            </td>
                            <td className="text-center font-bold text-slate-400">
                              {g.retInasist}
                            </td>
                            <td className="text-center bg-blue-100/50 text-blue-900 font-black">
                              {g.totalActivos}
                            </td>
                          </tr>
                          {g.cursos.map((curso: any, cIdx: number) => (
                            <tr key={cIdx} className="hover:bg-slate-50 group">
                              <td className="pl-10 p-3 text-slate-500 font-medium border-l-2 border-transparent group-hover:border-blue-300 group-hover:text-slate-800 transition-all">
                                {curso.nombre}
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={curso.matriculados}
                                  onChange={(e) =>
                                    updateCurso(
                                      i,
                                      cIdx,
                                      "matriculados",
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="w-16 mx-auto block border border-slate-200 text-center rounded-lg h-8 focus:ring-2 focus:ring-blue-400 outline-none text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={curso.retOctda}
                                  onChange={(e) =>
                                    updateCurso(
                                      i,
                                      cIdx,
                                      "retOctda",
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="w-16 mx-auto block border border-slate-200 text-center rounded-lg h-8 focus:ring-2 focus:ring-blue-400 outline-none text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={curso.retInasist}
                                  onChange={(e) =>
                                    updateCurso(
                                      i,
                                      cIdx,
                                      "retInasist",
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="w-16 mx-auto block border border-slate-200 text-center rounded-lg h-8 focus:ring-2 focus:ring-blue-400 outline-none text-xs"
                                />
                              </td>
                              <td className="text-center font-black text-emerald-600 bg-emerald-50/30">
                                {curso.totalActivos}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vista principal (lista) ─────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-2 text-blue-700 mb-1">
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Gestión Académica
          </span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Nómina <span className="text-blue-600">UAI</span>
        </h1>
        <p className="text-slate-500 mt-1">
          Sube el reporte PDF de matriculados de una carrera y arma la nómina de
          Ciclo 1 y 2 automáticamente.
        </p>
      </header>

      {/* Zona de carga */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-[1.01]"
            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
        }`}
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-blue-600 font-bold">Procesando PDF...</p>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-blue-400 mx-auto mb-3" />
            <p className="text-slate-700 font-bold text-lg">
              Arrastra uno o varios PDFs aquí
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Cada PDF se agrega al mismo documento — puedes combinar varias
              carreras
            </p>
            <Button
              className="mt-5 bg-blue-600 hover:bg-blue-700 pointer-events-none"
              size="lg"
            >
              <Upload className="mr-2 w-4 h-4" /> Subir PDF
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Lista de nóminas guardadas */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" /> Nóminas guardadas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {list.length} registradas
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadList}
            className="text-slate-500"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loadingList ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4 text-left">Carrera / Nómina</th>
                <th className="px-6 py-4 text-left">Periodo</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-left">Actualizado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((n) => (
                <tr
                  key={n.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {n.carrera}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {n.periodo}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge
                      variant={n.estado === "FINAL" ? "default" : "secondary"}
                      className="rounded-full px-3"
                    >
                      {n.estado}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {n.updatedAt
                      ? new Date(n.updatedAt).toLocaleString("es-PE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                      onClick={() =>
                        fetch(`${apiBase}/api/nominas/${n.id}`, {
                          credentials: "include",
                        })
                          .then((r) => r.json())
                          .then(setEditing)
                      }
                    >
                      Abrir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteNomina(n.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && !loadingList && (
            <div className="p-20 text-center text-slate-400 italic">
              No hay nóminas guardadas. Sube un PDF para empezar.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
