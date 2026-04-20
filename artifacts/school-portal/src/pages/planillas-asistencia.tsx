import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardCheck, User, BookOpen, Loader2, FileSpreadsheet, ChevronRight, CheckCircle2, Download } from "lucide-react";
import * as ExcelJS from "exceljs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AsistenciaPlanillaDialog, type CursoCtx } from "@/components/asistencia-planilla-dialog";

type Row = {
  carrera: string; carreraFull: string; ciclo: string; seccion: string;
  codigo: string; curso: string; modalidadCurso: string;
  horasT: number; horasP: number; horas: number;
  docente: string; modalidad: string;
  dia: string; hora: string; horaFin: string; horasAcad: number;
  pabellon?: string; aula?: string; laboratorio?: string;
  local?: string; turno?: string; tipo?: string;
};

const FACULTADES = [
  { key: "FICA", file: "planificacion-fica-2026-1.json", label: "FICA · Estudios Generales" },
  { key: "FCS",  file: "planificacion-fcs-2026-1.json",  label: "FCS · Ciencias de la Salud"  },
] as const;

function turnoFromHora(hora: string): string {
  const h = parseInt((hora || "").split(":")[0]);
  return Number.isFinite(h) && h < 18 ? "DIURNO" : "NOCTURNO";
}

export default function PlanillasAsistencia() {
  const { toast } = useToast();
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [asistenciaCurso, setAsistenciaCurso] = useState<CursoCtx | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [uploadedByDocente, setUploadedByDocente] = useState<Map<string, number>>(new Map());
  const [exporting, setExporting] = useState(false);

  const exportarPorCarrera = async () => {
    setExporting(true);
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      const listRes = await fetch(`${base}/api/asistencia-planillas`, { credentials: "include" });
      if (!listRes.ok) throw new Error("list");
      const list = (await listRes.json()) as Array<{
        id: number; docente: string|null; carrera: string|null; ciclo: string|null;
        seccion: string|null; codigoCurso: string|null; nombreCurso: string|null;
      }>;
      const lista = list.filter(p => p.ciclo === "1" || p.ciclo === "2");
      if (lista.length === 0) {
        toast({ title: "Sin asistencias registradas", description: "Aún no hay planillas subidas.", variant: "destructive" });
        return;
      }

      // Traer detalle de cada planilla (alumnos + totales)
      const detalles = await Promise.all(lista.map(async p => {
        const r = await fetch(`${base}/api/asistencia-planillas/${p.id}`, { credentials: "include" });
        return r.ok ? await r.json() : null;
      }));
      const planillas = detalles.filter(Boolean) as Array<{
        id: number; docente: string|null; carrera: string|null; ciclo: string|null;
        seccion: string|null; codigoCurso: string|null; nombreCurso: string|null;
        alumnos: Array<{ numero: string; nombre: string; marcas: string[]; porcentaje: number }>;
        weeks: Array<{ label: string }>;
      }>;

      // Agrupar por carrera
      const porCarrera = new Map<string, typeof planillas>();
      for (const p of planillas) {
        const k = (p.carrera || "SIN CARRERA").toUpperCase().trim();
        if (!porCarrera.has(k)) porCarrera.set(k, []);
        porCarrera.get(k)!.push(p);
      }

      const wb = new ExcelJS.Workbook();
      const NAVY = "FF001F5F";
      const GOLD = "FFC9A84C";
      const WHITE = "FFFFFFFF";
      const GREEN_BG = "FFDCFCE7";
      const RED_BG   = "FFFEE2E2";
      const sf = (a: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
      const CTR = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
      const LEFT = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
      const THIN: Partial<ExcelJS.Borders> = {
        top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
      };

      const sortedCarreras = Array.from(porCarrera.keys()).sort();
      for (const carrera of sortedCarreras) {
        const items = porCarrera.get(carrera)!;
        // Ordenar: ciclo, sección, curso
        items.sort((a, b) =>
          (a.ciclo||"").localeCompare(b.ciclo||"") ||
          (a.seccion||"").localeCompare(b.seccion||"") ||
          (a.nombreCurso||"").localeCompare(b.nombreCurso||"")
        );

        const safeName = carrera.replace(/[\\/*?:[\]]/g, "").slice(0, 30) || "Carrera";
        const ws = wb.addWorksheet(safeName, { views: [{ state: "frozen", ySplit: 2 }] });
        ws.columns = [
          { width: 5 },   // #
          { width: 40 },  // Apellidos y Nombres
          { width: 14 },  // Asistencias
          { width: 14 },  // Inasistencias
          { width: 12 },  // % Asistencia
        ];

        // Título de carrera
        ws.mergeCells("A1:E1");
        const t = ws.getCell("A1");
        t.value = `UNIVERSIDAD AUTÓNOMA DE ICA — ${carrera} — ASISTENCIA 2026-I`;
        t.font = { bold: true, size: 13, color: { argb: WHITE } };
        t.fill = sf(NAVY); t.alignment = CTR; t.border = THIN;
        ws.getRow(1).height = 28;

        let r = 3;
        for (const p of items) {
          // Encabezado de curso (Ciclo+Sección - Curso)
          ws.mergeCells(r, 1, r, 5);
          const head = ws.getCell(r, 1);
          const label = `${carrera} ${p.ciclo || ""}${p.seccion || ""} — ${p.nombreCurso || p.codigoCurso || ""}`;
          head.value = label.trim();
          head.font = { bold: true, size: 11, color: { argb: NAVY } };
          head.fill = sf(GOLD); head.alignment = LEFT; head.border = THIN;
          ws.getRow(r).height = 22;
          r++;

          // Subtítulo docente
          ws.mergeCells(r, 1, r, 5);
          const sub = ws.getCell(r, 1);
          sub.value = `Docente: ${p.docente || "—"}   ·   Semanas registradas: ${p.weeks?.length ?? 0}`;
          sub.font = { italic: true, size: 9, color: { argb: "FF555555" } };
          sub.alignment = LEFT; sub.border = THIN;
          ws.getRow(r).height = 16;
          r++;

          // Encabezado de tabla
          const heads = ["#", "Apellidos y Nombres", "Asistencias", "Inasistencias", "% Asist."];
          heads.forEach((h, i) => {
            const c = ws.getRow(r).getCell(i + 1);
            c.value = h; c.font = { bold: true, size: 10, color: { argb: WHITE } };
            c.fill = sf(NAVY); c.alignment = CTR; c.border = THIN;
          });
          ws.getRow(r).height = 18;
          r++;

          // Alumnos
          p.alumnos.forEach((a, i) => {
            const cols = a.marcas.length;
            let asis = 0, inas = 0;
            for (let k = 0; k < cols; k++) {
              const m = (a.marcas[k] || "").toUpperCase();
              if (m === "A") asis++;
              else if (m === "F") inas++;
            }
            const total = asis + inas;
            const porc = total > 0 ? (asis / total) * 100 : 0;

            const row = ws.getRow(r);
            row.getCell(1).value = i + 1;
            row.getCell(2).value = a.nombre;
            row.getCell(3).value = asis;
            row.getCell(4).value = inas;
            row.getCell(5).value = `${porc.toFixed(2)}%`;

            row.getCell(1).alignment = CTR;
            row.getCell(2).alignment = LEFT;
            row.getCell(3).alignment = CTR;
            row.getCell(4).alignment = CTR;
            row.getCell(5).alignment = CTR;

            row.getCell(3).fill = sf(GREEN_BG);
            row.getCell(4).fill = sf(RED_BG);

            for (let c = 1; c <= 5; c++) {
              row.getCell(c).border = THIN;
              row.getCell(c).font = { size: 10 };
            }
            row.height = 16;
            r++;
          });

          // Totales del curso
          const totalAsis = p.alumnos.reduce((s, a) => s + a.marcas.filter(m => (m||"").toUpperCase() === "A").length, 0);
          const totalInas = p.alumnos.reduce((s, a) => s + a.marcas.filter(m => (m||"").toUpperCase() === "F").length, 0);
          const tot = totalAsis + totalInas;
          const totPorc = tot > 0 ? (totalAsis / tot) * 100 : 0;
          const tRow = ws.getRow(r);
          tRow.getCell(1).value = "";
          tRow.getCell(2).value = `TOTAL (${p.alumnos.length} alumnos)`;
          tRow.getCell(3).value = totalAsis;
          tRow.getCell(4).value = totalInas;
          tRow.getCell(5).value = `${totPorc.toFixed(2)}%`;
          for (let c = 1; c <= 5; c++) {
            tRow.getCell(c).font = { bold: true, size: 10, color: { argb: WHITE } };
            tRow.getCell(c).fill = sf(NAVY);
            tRow.getCell(c).alignment = c === 2 ? LEFT : CTR;
            tRow.getCell(c).border = THIN;
          }
          tRow.height = 20;
          r += 2; // espacio entre cursos
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Asistencia_por_Carrera_UAI_2026-1.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Excel generado", description: `${sortedCarreras.length} carreras exportadas.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const loadUploaded = async () => {
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      const r = await fetch(`${base}/api/asistencia-planillas`, { credentials: "include" });
      if (!r.ok) return;
      const list = (await r.json()) as Array<{ docente: string | null; codigoCurso: string | null; seccion: string | null }>;
      const set = new Set<string>();
      const cnt = new Map<string, number>();
      for (const p of list) {
        if (!p.docente || !p.codigoCurso) continue;
        const k = `${p.docente.toUpperCase().trim()}|${p.codigoCurso.trim()}|${p.seccion || ""}`;
        set.add(k);
        const dk = p.docente.toUpperCase().trim();
        cnt.set(dk, (cnt.get(dk) || 0) + 1);
      }
      setUploaded(set);
      setUploadedByDocente(cnt);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const all: Row[] = [];
        for (const f of FACULTADES) {
          try {
            const r = await fetch(`${base}/${f.file}`);
            if (!r.ok) continue;
            const arr = (await r.json()) as Row[];
            arr.forEach((row) => all.push(row));
          } catch { /* ignore */ }
        }
        setData(all);
        await loadUploaded();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const teachers = useMemo(() => {
    const map = new Map<string, { count: number; carreras: Set<string> }>();
    for (const r of data) {
      // Solo ciclos 1 y 2
      if (String(r.ciclo) !== "1" && String(r.ciclo) !== "2") continue;
      const k = r.docente?.toUpperCase().trim();
      if (!k) continue;
      if (!map.has(k)) map.set(k, { count: 0, carreras: new Set() });
      const v = map.get(k)!;
      v.count++;
      v.carreras.add(r.carrera);
    }
    return Array.from(map.entries())
      .map(([n, v]) => ({ nombre: n, sesiones: v.count, carreras: Array.from(v.carreras) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? teachers.filter((t) => t.nombre.toLowerCase().includes(q)) : teachers;
  }, [teachers, search]);

  /* Cursos únicos del docente (agrupados por código + sección) */
  const cursos = useMemo(() => {
    if (!selected) return [];
    const rows = data.filter(
      (r) =>
        r.docente?.toUpperCase().trim() === selected &&
        (String(r.ciclo) === "1" || String(r.ciclo) === "2"),
    );
    const map = new Map<string, Row & { sesiones: number }>();
    for (const r of rows) {
      const k = `${r.codigo}|${r.seccion}|${r.carrera}|${r.ciclo}`;
      if (!map.has(k)) map.set(k, { ...r, sesiones: 0 });
      map.get(k)!.sesiones++;
    }
    return Array.from(map.values()).sort((a, b) => {
      const c = a.carrera.localeCompare(b.carrera);
      if (c !== 0) return c;
      const ci = a.ciclo.localeCompare(b.ciclo);
      if (ci !== 0) return ci;
      return a.seccion.localeCompare(b.seccion);
    });
  }, [data, selected]);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Planillas de Asistencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona un docente, abre cualquiera de sus cursos e importa el Excel "Reporte de Asistencia de Estudiantes".
            Al ver una planilla aparecerá también el horario por aula que se está formando para esos estudiantes.
          </p>
        </div>
        <Button
          onClick={exportarPorCarrera}
          disabled={exporting}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {exporting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
            : <><Download className="h-4 w-4" /> Excel por Carrera</>
          }
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando docentes…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista de docentes */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-border/50 shadow-sm flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-primary" />
                Docentes ({teachers.length})
              </h2>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar docente…"
                  className="pl-8 h-9"
                  data-testid="input-search-docente"
                />
              </div>
            </div>
            <div className="overflow-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sin coincidencias</div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.nombre}
                    onClick={() => setSelected(t.nombre)}
                    className={`w-full text-left px-4 py-2.5 text-sm border-b border-border/30 transition-colors flex items-center gap-2 ${
                      selected === t.nombre ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/40"
                    }`}
                    data-testid={`button-docente-${t.nombre}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.nombre}</div>
                      <div className="text-[10px] text-muted-foreground flex gap-1 mt-0.5 flex-wrap">
                        {t.carreras.map((c) => (
                          <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 h-4">{c}</Badge>
                        ))}
                        <span className="ml-1">{t.sesiones} ses.</span>
                        {(uploadedByDocente.get(t.nombre) || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 ml-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="h-3 w-3" />
                            {uploadedByDocente.get(t.nombre)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Cursos del docente */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-border/50 shadow-sm flex flex-col max-h-[80vh]">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-12 text-center">
                <div>
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Selecciona un docente para ver sus cursos</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border/50">
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Cursos de <span className="text-primary">{selected}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{cursos.length} cursos · click en "Planilla" para importar/ver el Excel y el horario del aula</p>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-center font-semibold w-8"></th>
                        <th className="px-3 py-2 text-left font-semibold">Carrera</th>
                        <th className="px-3 py-2 text-center font-semibold">Ciclo</th>
                        <th className="px-3 py-2 text-center font-semibold">Sec</th>
                        <th className="px-3 py-2 text-left font-semibold">Código</th>
                        <th className="px-3 py-2 text-left font-semibold">Curso</th>
                        <th className="px-3 py-2 text-left font-semibold">Modalidad</th>
                        <th className="px-3 py-2 text-center font-semibold">Sesiones</th>
                        <th className="px-3 py-2 text-right font-semibold">Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cursos.map((c, i) => {
                        const isUploaded = uploaded.has(`${selected}|${c.codigo}|${c.seccion}`);
                        return (
                        <tr key={i} className={`${i % 2 ? "bg-muted/20" : ""} ${isUploaded ? "bg-emerald-50/40" : ""}`}>
                          <td className="px-3 py-2 text-center">
                            {isUploaded && (
                              <span title="Planilla subida">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 inline-block" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]">{c.carrera}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">{c.ciclo}</td>
                          <td className="px-3 py-2 text-center font-mono">{c.seccion}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{c.codigo}</td>
                          <td className="px-3 py-2 font-medium max-w-[220px]">
                            <span className="line-clamp-2">{c.curso}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{c.modalidad}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{c.sesiones}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant={isUploaded ? "outline" : "default"}
                              className={`h-7 px-2.5 gap-1.5 text-[10px] ${isUploaded ? "border-emerald-500 text-emerald-700 hover:bg-emerald-50" : ""}`}
                              onClick={() => setAsistenciaCurso({
                                docente: selected,
                                codigoCurso: c.codigo,
                                nombreCurso: c.curso,
                                carrera: c.carrera,
                                ciclo: c.ciclo,
                                seccion: c.seccion,
                                turno: c.turno || turnoFromHora(c.hora),
                                sede: c.local,
                                modalidad: c.modalidad,
                                dia: c.dia,
                              })}
                              data-testid={`button-planilla-${i}`}
                            >
                              {isUploaded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                              {isUploaded ? "Subida" : "Planilla"}
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {asistenciaCurso && (
        <AsistenciaPlanillaDialog
          open={!!asistenciaCurso}
          curso={asistenciaCurso}
          onClose={() => { setAsistenciaCurso(null); loadUploaded(); }}
          allRows={data}
        />
      )}
    </div>
  );
}
