import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Search, Download, ClipboardCheck, ChevronUp, ChevronDown,
  Users, BookX,
} from "lucide-react";
import * as ExcelJS from "exceljs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLogPageEntry } from "@/hooks/use-activity-log";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type PlanillaItem = {
  id: number; docente: string | null; carrera: string | null; ciclo: string | null;
  seccion: string | null; codigoCurso: string | null; nombreCurso: string | null; sede: string | null;
};
type AlumnoRow = { numero: string; nombre: string; marcas: string[] };
type PlanillaDetail = PlanillaItem & {
  weeks: Array<{ label: string; fecha?: string; dia?: string; slots?: 1 | 2 }>;
  alumnos: AlumnoRow[];
};

type Fila = {
  docente: string;
  curso: string;
  codigo: string;
  seccion: string;
  local: string;
  ciclo: string;
  codAlumno: string;
  alumno: string;
  carrera: string;       // ← Programa académico (lookup desde el consolidado de matrícula)
  carreraOrigen: "consolidado" | "planilla" | "desconocido";
  localOrigen: "consolidado" | "planilla";
  enConsolidado: boolean; // ← true si encontramos al alumno en el consolidado
  convalidante: boolean; // ← true si figura en la lista oficial de convalidantes 2026-1
  presentes: number;
  ausentes: number;
  pct: number;
  estado: "APROBADO" | "DESAPROBADO";
};

type SortKey = keyof Fila;

// Normaliza nombres para cruzar la planilla del intranet (que NO trae código)
// contra el consolidado de matrícula y la lista oficial de convalidantes.
// Mayúsculas, sin tildes, sin puntuación, espacios colapsados.
const normalizaNombre = (s: string): string =>
  (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sedeLabel = (v: string | null | undefined) => {
  const s = (v || "").toUpperCase().trim();
  if (!s || s === "PRINCIPAL" || s === "ICA") return "PRINCIPAL";
  if (s === "FILIAL" || s === "CHINCHA") return "FILIAL";
  return s;
};

export default function ReporteAsistencia() {
  useLogPageEntry("Reporte de Asistencia");
  const { toast } = useToast();

  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch]       = useState("");
  const [sedeF, setSedeF]         = useState("TODAS");
  const [docenteF, setDocenteF]   = useState("TODOS");
  const [cicloF, setCicloF]       = useState<"TODOS" | "1" | "2">("TODOS");
  const [estadoF, setEstadoF]     = useState<"TODOS" | "APROBADO" | "DESAPROBADO">("TODOS");
  const [sortKey, setSortKey]     = useState<SortKey>("docente");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [vista, setVista]         = useState<"matricula" | "alumno">("matricula");

  const abortRef = useRef<AbortController | null>(null);

  const cargar = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setLoaded(false);
    setFilas([]);

    try {
      const base = `${apiBase}/`;
      const [r, ficaPlan, fcsPlan, alumnosInfoRaw, convalRaw] = await Promise.all([
        fetch(`${apiBase}/api/asistencia-planillas/all-full`, { credentials: "include", signal: ctrl.signal }),
        fetch(`${base}planificacion-fica-2026-1.json`).then(x => x.ok ? x.json() : []).catch(() => []),
        fetch(`${base}planificacion-fcs-2026-1.json`).then(x => x.ok ? x.json() : []).catch(() => []),
        // Lookup desde el consolidado de matrícula: nombre_normalizado → { codigo, carrera }
        // (las planillas del intranet NO traen el código, solo número de fila, así que
        // cruzamos por nombre para obtener el código real y la carrera).
        fetch(`${base}alumnos-info-2026-1.json`).then(x => x.ok ? x.json() : {}).catch(() => ({})),
        // Lista oficial de convalidantes 2026-1
        fetch(`${base}convalidantes-2026-1.json`).then(x => x.ok ? x.json() : []).catch(() => []),
      ]);
      if (!r.ok) throw new Error("list");
      const detalles = (await r.json()) as PlanillaDetail[];

      // Mapa codigo_upper → ciclo y → carreraFull desde los JSON de planificación.
      // La carrera por curso sirve como FALLBACK cuando el alumno no se pudo
      // cruzar por nombre con el consolidado (errata, alumno nuevo, etc.).
      const codigoCicloMap = new Map<string, string>();
      const codigoCarreraMap = new Map<string, string>();
      for (const row of [...(Array.isArray(ficaPlan) ? ficaPlan : []), ...(Array.isArray(fcsPlan) ? fcsPlan : [])]) {
        if (row?.codigo) {
          const k = String(row.codigo).toUpperCase().trim();
          if (row?.ciclo) codigoCicloMap.set(k, String(row.ciclo).trim());
          if (row?.carreraFull && !codigoCarreraMap.has(k)) {
            codigoCarreraMap.set(k, String(row.carreraFull).trim());
          }
        }
      }

      // Mapa nombre_normalizado → { codigo, carrera, local }
      const infoPorNombre = new Map<string, { codigo: string; carrera: string; local: string }>();
      for (const [k, v] of Object.entries(alumnosInfoRaw as Record<string, { codigo?: string; carrera?: string; local?: string }>)) {
        if (k) infoPorNombre.set(k, {
          codigo: v?.codigo || "",
          carrera: v?.carrera || "",
          local: v?.local || "",
        });
      }

      // Set de NOMBRES convalidantes normalizados (las planillas no traen código,
      // así que cotejamos por nombre — coherente con la lógica de jalados).
      const convalNombres = new Set<string>();
      for (const c of (convalRaw as Array<{ nombre?: string }>)) {
        const n = normalizaNombre(c?.nombre || "");
        if (n) convalNombres.add(n);
      }

      const out: Fila[] = [];
      for (const det of detalles) {
        if (!det) continue;
        // Obtener ciclo desde el mapa de planificación
        const codigoKey = (det.codigoCurso || "").toUpperCase().trim();
        const ciclo = codigoCicloMap.get(codigoKey) ?? "";
        // Solo ciclos 1 y 2
        if (ciclo !== "1" && ciclo !== "2") continue;

        const weeksLen = det.weeks?.length || 0;
        let maxMarcas = 0;
        for (const a of det.alumnos || []) {
          if ((a.marcas?.length || 0) > maxMarcas) maxMarcas = a.marcas.length;
        }
        const N = weeksLen > 0 ? weeksLen : Math.ceil(maxMarcas / 2);

        for (const a of det.alumnos || []) {
          let pres = 0, inas = 0;
          for (let w = 0; w < N; w++) {
            const m1 = (a.marcas?.[w * 2]     || "").toUpperCase().trim();
            const m2 = (a.marcas?.[w * 2 + 1] || "").toUpperCase().trim();
            if (m1 === "F" || m2 === "F") inas++;
            else if (m1 === "A" || m2 === "A") pres++;
          }
          const total = pres + inas;
          const pct = total > 0 ? Math.round((pres / total) * 10000) / 100 : 0;
          const nombreUp = (a.nombre || "").toUpperCase();
          const nombreKey = normalizaNombre(nombreUp);
          const info = infoPorNombre.get(nombreKey);
          // Si encontramos al alumno en el consolidado, usamos su código real;
          // si no, mostramos el número de fila de la planilla como respaldo.
          const codAlu = info?.codigo || (a.numero || "").toUpperCase().trim();
          // Carrera: primero la del consolidado (más confiable), si no, la del
          // curso desde la planificación (todos los matriculados a un curso
          // pertenecen normalmente a la misma carrera).
          const carreraConsolidado = info?.carrera || "";
          const carreraPlanilla = codigoCarreraMap.get((det.codigoCurso || "").toUpperCase().trim()) || "";
          const carrera = carreraConsolidado || carreraPlanilla;
          const carreraOrigen: "consolidado" | "planilla" | "desconocido" =
            carreraConsolidado ? "consolidado" : carreraPlanilla ? "planilla" : "desconocido";
          // Local: el del alumno (consolidado) es el más preciso, ya que dice
          // dónde estudia el alumno (CHINCHA, ICA, HUAURA, SUNAMPE, PORUMA).
          // Si no se encuentra, caemos al sede de la planilla (donde se dicta).
          const localAlu = info?.local || sedeLabel(det.sede);
          const localOrigen: "consolidado" | "planilla" = info?.local ? "consolidado" : "planilla";
          out.push({
            docente:   (det.docente   || "").toUpperCase(),
            curso:     (det.nombreCurso || "").toUpperCase(),
            codigo:    (det.codigoCurso || "").toUpperCase(),
            seccion:   (det.seccion   || "").toUpperCase(),
            local:     localAlu,
            ciclo,
            codAlumno: codAlu,
            alumno:    nombreUp,
            carrera,
            carreraOrigen,
            localOrigen,
            enConsolidado: !!info,
            convalidante: convalNombres.has(nombreKey),
            presentes: pres,
            ausentes:  inas,
            pct,
            estado:    pres === 0 ? "DESAPROBADO" : "APROBADO",
          });
        }
      }
      setFilas(out);
      setLoaded(true);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Error al cargar", description: String(e.message), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Derivados ─────────────────────────────────────────────────── */
  const sedes    = useMemo(() => ["TODAS", ...Array.from(new Set(filas.map(f => f.local))).sort()], [filas]);
  const docentes = useMemo(() => ["TODOS", ...Array.from(new Set(filas.map(f => f.docente))).sort()], [filas]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return filas.filter(f => {
      if (sedeF    !== "TODAS"  && f.local    !== sedeF)    return false;
      if (docenteF !== "TODOS"  && f.docente  !== docenteF) return false;
      if (cicloF   !== "TODOS"  && f.ciclo    !== cicloF)   return false;
      if (estadoF  !== "TODOS"  && f.estado   !== estadoF)  return false;
      if (q && ![f.alumno, f.codAlumno, f.curso, f.codigo, f.docente, f.seccion].some(v => v.includes(q))) return false;
      return true;
    });
  }, [filas, sedeF, docenteF, cicloF, estadoF, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  /* ── Vista por alumno (cuántos cursos va jalando cada uno) ──────── */
  type FilaAlumno = {
    alumno: string;
    codAlumno: string;
    carrera: string;
    carreraOrigen: "consolidado" | "planilla" | "desconocido";
    local: string;
    localOrigen: "consolidado" | "planilla";
    enConsolidado: boolean;
    convalidante: boolean;
    totalCursos: number;
    cursosJalando: number;
    pctPromedio: number;
    cursosJaladosLista: string;   // "MATEMÁTICA I, FILOSOFÍA Y ÉTICA"
  };
  type SortKeyAlumno = keyof FilaAlumno;
  const [sortKeyAlu, setSortKeyAlu] = useState<SortKeyAlumno>("cursosJalando");
  const [sortDirAlu, setSortDirAlu] = useState<"asc" | "desc">("desc");

  const porAlumno = useMemo<FilaAlumno[]>(() => {
    if (vista !== "alumno") return [];
    // Agrupamos por nombre normalizado (las planillas no traen código real)
    const grupos = new Map<string, Fila[]>();
    for (const f of filtered) {
      const k = normalizaNombre(f.alumno);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(f);
    }
    const out: FilaAlumno[] = [];
    for (const [, rows] of grupos) {
      const r0 = rows[0];
      const jalados = rows.filter(r => r.estado === "DESAPROBADO");
      const sumPct = rows.reduce((acc, r) => acc + r.pct, 0);
      // Carrera "ganadora": la más frecuente no vacía
      const carreras = new Map<string, number>();
      for (const r of rows) if (r.carrera) carreras.set(r.carrera, (carreras.get(r.carrera) || 0) + 1);
      const carrera = [...carreras.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      // Origen de carrera: consolidado si CUALQUIER fila lo tuvo desde consolidado;
      // de lo contrario, planilla si alguna lo tuvo de planilla; sino desconocido.
      const carreraOrigen: "consolidado" | "planilla" | "desconocido" =
        rows.some(r => r.carreraOrigen === "consolidado") ? "consolidado"
        : rows.some(r => r.carreraOrigen === "planilla") ? "planilla"
        : "desconocido";
      const localOrigen: "consolidado" | "planilla" =
        rows.some(r => r.localOrigen === "consolidado") ? "consolidado" : "planilla";
      const enConsolidado = rows.some(r => r.enConsolidado);
      out.push({
        alumno: r0.alumno,
        codAlumno: r0.codAlumno,
        carrera,
        carreraOrigen,
        local: r0.local,
        localOrigen,
        enConsolidado,
        convalidante: rows.some(r => r.convalidante),
        totalCursos: rows.length,
        cursosJalando: jalados.length,
        pctPromedio: rows.length ? Math.round((sumPct / rows.length) * 100) / 100 : 0,
        cursosJaladosLista: jalados.map(r => r.curso).join(", "),
      });
    }
    return out;
  }, [filtered, vista]);

  const porAlumnoSorted = useMemo(() => {
    return [...porAlumno].sort((a, b) => {
      const av = a[sortKeyAlu]; const bv = b[sortKeyAlu];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "es");
      return sortDirAlu === "asc" ? cmp : -cmp;
    });
  }, [porAlumno, sortKeyAlu, sortDirAlu]);

  const toggleSortAlu = (k: SortKeyAlumno) => {
    if (sortKeyAlu === k) setSortDirAlu(d => d === "asc" ? "desc" : "asc");
    else { setSortKeyAlu(k); setSortDirAlu(k === "alumno" || k === "carrera" ? "asc" : "desc"); }
  };

  /* ── Estadísticas resumen ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = filtered.length;
    const apro  = filtered.filter(f => f.estado === "APROBADO").length;
    const des   = total - apro;
    return { total, apro, des };
  }, [filtered]);

  /* ── Exportar Excel — Por alumno (cursos jalando) ──────────────── */
  const exportarPorAlumno = async () => {
    if (!porAlumnoSorted.length) return;
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Por alumno");
      const NAVY = "001f5f"; const GOLD = "c9a84c"; const WHITE = "FFFFFF";
      const RED  = "b91c1c"; const GREEN = "15803d";
      const AMB_BG = "FEF3C7", AMB_TX = "92400E";

      ws.columns = [
        { key: "alumno",     width: 38 },
        { key: "codAlumno",  width: 16 },
        { key: "carrera",    width: 30 },
        { key: "fuenteCar",  width: 16 },
        { key: "local",      width: 14 },
        { key: "fuenteLoc",  width: 16 },
        { key: "totalCursos",width: 14 },
        { key: "jalando",    width: 12 },
        { key: "pct",        width: 14 },
        { key: "lista",      width: 60 },
        { key: "obs",        width: 38 },
      ];
      const header = ws.addRow([
        "Alumno","COD ALUMNO","Carrera","Fuente carrera","Local","Fuente local",
        "Total cursos","Jalando","% Asist. promedio","Cursos jalando","Observación",
      ]);
      header.eachCell(c => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        c.font = { bold: true, color: { argb: WHITE }, size: 10 };
        c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        c.border = {
          top:    { style: "thin", color: { argb: GOLD } },
          bottom: { style: "thin", color: { argb: GOLD } },
          left:   { style: "thin", color: { argb: GOLD } },
          right:  { style: "thin", color: { argb: GOLD } },
        };
      });
      header.height = 22;

      // Etiquetas legibles del origen
      const lblCar = (o: string) =>
        o === "consolidado" ? "CONSOLIDADO" : o === "planilla" ? "PLANILLA" : "DESCONOCIDO";
      const lblLoc = (o: string) =>
        o === "consolidado" ? "CONSOLIDADO" : "PLANILLA (sede)";
      // Colores de fondo para "Fuente"
      const FUENTE_OK_BG = "DCFCE7"; // verde claro (consolidado)
      const FUENTE_WARN_BG = "FEF3C7"; // ámbar (planilla)
      const FUENTE_BAD_BG = "FEE2E2"; // rojo claro (desconocido)
      const FUENTE_OK_TX = "166534";
      const FUENTE_WARN_TX = "92400E";
      const FUENTE_BAD_TX = "991B1B";

      porAlumnoSorted.forEach((a, i) => {
        // Observación: combina convalidante + advertencia si NO está en consolidado
        const obsParts: string[] = [];
        if (!a.enConsolidado) obsParts.push("NO ENCONTRADO EN CONSOLIDADO");
        if (a.carreraOrigen === "planilla") obsParts.push("Carrera tomada de planilla");
        if (a.carreraOrigen === "desconocido") obsParts.push("Carrera no identificada");
        if (a.localOrigen === "planilla" && a.enConsolidado === false) {
          // ya implícito por "no encontrado", no duplicar
        } else if (a.localOrigen === "planilla") {
          obsParts.push("Local tomado de planilla");
        }
        if (a.convalidante) obsParts.push("CONVALIDANTE");
        const obsTxt = obsParts.join(" · ");

        const row = ws.addRow([
          a.alumno, a.codAlumno, a.carrera || "—",
          lblCar(a.carreraOrigen),
          a.local,
          lblLoc(a.localOrigen),
          a.totalCursos, a.cursosJalando, a.pctPromedio,
          a.cursosJaladosLista || "", obsTxt,
        ]);
        const baseBg = a.convalidante ? AMB_BG : (i % 2 === 0 ? "F8F9FA" : "FFFFFF");
        row.eachCell(c => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseBg } };
          c.font = { size: 9 };
          c.alignment = { vertical: "middle" };
          c.border = {
            left:  { style: "hair", color: { argb: "DDDDDD" } },
            right: { style: "hair", color: { argb: "DDDDDD" } },
            bottom:{ style: "hair", color: { argb: "DDDDDD" } },
          };
        });
        // Centrado de columnas numéricas (col 7=Total, 8=Jalando, 9=%)
        [4, 6, 7, 8, 9].forEach(c => { row.getCell(c).alignment = { horizontal: "center" }; });
        // % format (col 9)
        row.getCell(9).numFmt = "0.00";
        // Jalando (col 8) en rojo si > 0, verde si 0
        const jal = row.getCell(8);
        jal.font = { bold: true, color: { argb: a.cursosJalando > 0 ? RED : GREEN }, size: 9 };

        // Fuente carrera (col 4) — pintado por origen
        const fcCell = row.getCell(4);
        const fcBg = a.carreraOrigen === "consolidado" ? FUENTE_OK_BG
                    : a.carreraOrigen === "planilla" ? FUENTE_WARN_BG : FUENTE_BAD_BG;
        const fcTx = a.carreraOrigen === "consolidado" ? FUENTE_OK_TX
                    : a.carreraOrigen === "planilla" ? FUENTE_WARN_TX : FUENTE_BAD_TX;
        fcCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fcBg } };
        fcCell.font = { bold: true, color: { argb: fcTx }, size: 9 };

        // Fuente local (col 6)
        const flCell = row.getCell(6);
        const flBg = a.localOrigen === "consolidado" ? FUENTE_OK_BG : FUENTE_WARN_BG;
        const flTx = a.localOrigen === "consolidado" ? FUENTE_OK_TX : FUENTE_WARN_TX;
        flCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: flBg } };
        flCell.font = { bold: true, color: { argb: flTx }, size: 9 };

        // Observación (col 11) — ámbar si convalidante, rojo si no está en consolidado
        if (obsTxt) {
          const obs = row.getCell(11);
          const noConsol = !a.enConsolidado;
          obs.font = {
            bold: true,
            color: { argb: noConsol ? FUENTE_BAD_TX : AMB_TX },
            size: 9,
          };
          obs.fill = {
            type: "pattern", pattern: "solid",
            fgColor: { argb: noConsol ? FUENTE_BAD_BG : AMB_BG },
          };
        }
      });

      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: "A1", to: "K1" };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const aEl = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      aEl.href = url; aEl.download = `UAI-Reporte-Asistencia-PorAlumno-${date}.xlsx`;
      aEl.click(); URL.revokeObjectURL(url);
      toast({ title: "Excel generado", description: `${porAlumnoSorted.length} alumnos exportados.` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: String(e.message), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  /* ── Exportar Excel ────────────────────────────────────────────── */
  const exportar = async () => {
    if (!sorted.length) return;
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Reporte");

      const NAVY = "001f5f"; const GOLD = "c9a84c"; const WHITE = "FFFFFF";
      const RED  = "b91c1c"; const GREEN = "15803d";

      ws.columns = [
        { key: "docente",   width: 38 },
        { key: "curso",     width: 40 },
        { key: "codigo",    width: 14 },
        { key: "seccion",   width: 10 },
        { key: "local",     width: 12 },
        { key: "codAlumno", width: 16 },
        { key: "alumno",    width: 38 },
        { key: "carrera",   width: 30 },
        { key: "pres",      width: 12 },
        { key: "aus",       width: 12 },
        { key: "pct",       width: 14 },
        { key: "estado",    width: 15 },
        { key: "conv",      width: 16 },
      ];

      const header = ws.addRow([
        "Docente","Curso","Código","Sección","Local",
        "COD ALUMNO","Alumno","Carrera","Presentes","Ausentes","% Asistencia","Estado","Observación",
      ]);
      header.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: GOLD } },
          bottom: { style: "thin", color: { argb: GOLD } },
          left: { style: "thin", color: { argb: GOLD } },
          right: { style: "thin", color: { argb: GOLD } },
        };
      });
      header.height = 22;

      const AMB_BG = "FEF3C7", AMB_TX = "92400E";
      sorted.forEach((f, i) => {
        const row = ws.addRow([
          f.docente, f.curso, f.codigo, f.seccion, f.local,
          f.codAlumno, f.alumno, f.carrera || "—",
          f.presentes, f.ausentes, f.pct, f.estado,
          f.convalidante ? "CONVALIDANTE" : "",
        ]);
        // Resaltamos toda la fila si es convalidante (como en el screenshot del usuario)
        const bg = f.convalidante ? AMB_BG : (i % 2 === 0 ? "F8F9FA" : "FFFFFF");
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font = { size: 9 };
          cell.alignment = { vertical: "middle" };
          cell.border = {
            left:  { style: "hair", color: { argb: "DDDDDD" } },
            right: { style: "hair", color: { argb: "DDDDDD" } },
            bottom:{ style: "hair", color: { argb: "DDDDDD" } },
          };
        });
        // color estado (col 12)
        const estadoCell = row.getCell(12);
        const isApro = f.estado === "APROBADO";
        estadoCell.font = { bold: true, color: { argb: isApro ? GREEN : RED }, size: 9 };
        // color pct (col 11)
        const pctCell = row.getCell(11);
        pctCell.numFmt = "0.00";
        pctCell.alignment = { horizontal: "center" };
        // numeric cols center (presentes col 9, ausentes col 10)
        [9, 10].forEach(c => { row.getCell(c).alignment = { horizontal: "center" }; });
        // Observación CONVALIDANTE (col 13) en negrita ámbar
        if (f.convalidante) {
          const obs = row.getCell(13);
          obs.font = { bold: true, color: { argb: AMB_TX }, size: 9 };
          obs.alignment = { vertical: "middle", horizontal: "center" };
        }
      });

      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: "A1", to: "M1" };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `UAI-Reporte-Asistencia-${date}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: "Excel generado", description: `${sorted.length} filas exportadas.` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: String(e.message), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  /* ── Columnas de la tabla ──────────────────────────────────────── */
  const cols: { key: SortKey; label: string; cls?: string }[] = [
    { key: "docente",   label: "Docente" },
    { key: "curso",     label: "Curso" },
    { key: "codigo",    label: "Código",   cls: "hidden md:table-cell" },
    { key: "seccion",   label: "Secc.",    cls: "hidden md:table-cell" },
    { key: "local",     label: "Local",    cls: "hidden lg:table-cell" },
    { key: "codAlumno", label: "Cód. Alumno", cls: "hidden lg:table-cell" },
    { key: "alumno",    label: "Alumno" },
    { key: "carrera",   label: "Carrera",  cls: "hidden lg:table-cell" },
    { key: "presentes", label: "Pres.",    cls: "text-center" },
    { key: "ausentes",  label: "Aus.",     cls: "text-center" },
    { key: "pct",       label: "% Asist.", cls: "text-center hidden sm:table-cell" },
    { key: "estado",    label: "Estado",   cls: "text-center" },
  ];

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? null :
    sortDir === "asc"
      ? <ChevronUp className="inline h-3 w-3 ml-0.5" />
      : <ChevronDown className="inline h-3 w-3 ml-0.5" />;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            Reporte de Asistencia 2026-1
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen por alumno generado desde las planillas importadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={cargar} disabled={loading} variant="outline" className="gap-2">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</>
              : loaded ? "↺ Recargar" : "Cargar datos"
            }
          </Button>
          {loaded && (
            <Button
              onClick={vista === "alumno" ? exportarPorAlumno : exportar}
              disabled={exporting || (vista === "alumno" ? !porAlumnoSorted.length : !sorted.length)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {exporting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                : <><Download className="h-4 w-4" /> Excel{vista === "alumno" ? " por alumno" : ""}</>
              }
            </Button>
          )}
        </div>
      </div>

      {!loaded && !loading && (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
          <ClipboardCheck className="h-12 w-12 opacity-20" />
          <p className="text-sm">Presiona <strong>Cargar datos</strong> para generar el reporte.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
          <Loader2 className="h-10 w-10 animate-spin opacity-40" />
          <p className="text-sm">Calculando reporte desde las planillas…</p>
        </div>
      )}

      {loaded && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total alumnos",  val: stats.total, color: "text-gray-800" },
              { label: "Aprobados",      val: stats.apro,  color: "text-emerald-700" },
              { label: "Desaprobados",   val: stats.des,   color: "text-rose-700" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border/60 p-4 text-center shadow-sm">
                <div className={`text-3xl font-bold ${color}`}>{val.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Toggle de vista */}
          <div className="inline-flex rounded-lg border border-border/60 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setVista("matricula")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                vista === "matricula" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Por matrícula
            </button>
            <button
              onClick={() => setVista("alumno")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                vista === "alumno" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Por alumno (cursos jalando)
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alumno, código, curso…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={cicloF} onValueChange={v => setCicloF(v as typeof cicloF)}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Ciclo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los ciclos</SelectItem>
                <SelectItem value="1">Ciclo 1</SelectItem>
                <SelectItem value="2">Ciclo 2</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sedeF} onValueChange={setSedeF}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Local" /></SelectTrigger>
              <SelectContent>
                {sedes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={docenteF} onValueChange={setDocenteF}>
              <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Docente" /></SelectTrigger>
              <SelectContent>
                {docentes.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoF} onValueChange={v => setEstadoF(v as typeof estadoF)}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="DESAPROBADO">Desaprobado</SelectItem>
              </SelectContent>
            </Select>
            <span className="self-center text-xs text-muted-foreground whitespace-nowrap">
              {(vista === "alumno" ? porAlumnoSorted.length : sorted.length).toLocaleString()}{" "}
              {vista === "alumno" ? "alumnos" : "filas"}
            </span>
          </div>

          {/* Tabla — Por matrícula */}
          {vista === "matricula" && (
          <div className="rounded-xl border border-border/60 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#001f5f] text-white">
                  <tr>
                    {cols.map(c => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        className={`px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-[#003080] transition-colors ${c.cls ?? ""}`}
                      >
                        {c.label}<SortIcon k={c.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="text-center py-16 text-muted-foreground">
                        Sin resultados
                      </td>
                    </tr>
                  ) : sorted.map((f, i) => (
                    <tr
                      key={i}
                      className={
                        f.convalidante
                          ? "bg-amber-50 hover:bg-amber-100/70"
                          : (i % 2 === 0 ? "bg-white hover:bg-indigo-50/40" : "bg-gray-50/60 hover:bg-indigo-50/40")
                      }
                      title={f.convalidante ? "Estudiante convalidante (lista oficial 2026-1)" : undefined}
                    >
                      <td className="px-3 py-1.5 max-w-[220px] truncate" title={f.docente}>{f.docente}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={f.curso}>{f.curso}</td>
                      <td className="px-3 py-1.5 hidden md:table-cell font-mono">{f.codigo}</td>
                      <td className="px-3 py-1.5 hidden md:table-cell text-center">{f.seccion}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell text-center">{f.local}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell font-mono">{f.codAlumno}</td>
                      <td className="px-3 py-1.5 max-w-[220px]" title={f.alumno}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{f.alumno}</span>
                          {f.convalidante && (
                            <span
                              className="text-[9px] font-bold rounded px-1.5 py-px tracking-wider shrink-0"
                              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}
                            >
                              CONVALIDANTE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 hidden lg:table-cell max-w-[220px] truncate" title={f.carrera}>
                        {f.carrera || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center font-semibold text-emerald-700">{f.presentes}</td>
                      <td className="px-3 py-1.5 text-center font-semibold text-rose-700">{f.ausentes}</td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell">{f.pct.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge
                          className={f.estado === "APROBADO"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5"
                            : "bg-rose-100 text-rose-800 border-rose-200 text-[10px] px-1.5"
                          }
                          variant="outline"
                        >
                          {f.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Tabla — Por alumno (cursos jalando) */}
          {vista === "alumno" && (
          <div className="rounded-xl border border-border/60 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#001f5f] text-white">
                  <tr>
                    {([
                      { key: "alumno",         label: "Alumno" },
                      { key: "codAlumno",      label: "Cód. Alumno",   cls: "hidden md:table-cell" },
                      { key: "carrera",        label: "Carrera",       cls: "hidden lg:table-cell" },
                      { key: "local",          label: "Local",         cls: "hidden lg:table-cell text-center" },
                      { key: "totalCursos",    label: "Total cursos",  cls: "text-center" },
                      { key: "cursosJalando",  label: "Jalando",       cls: "text-center" },
                      { key: "pctPromedio",    label: "% Asist.",      cls: "text-center hidden sm:table-cell" },
                    ] as { key: SortKeyAlumno; label: string; cls?: string }[]).map(c => (
                      <th
                        key={c.key}
                        onClick={() => toggleSortAlu(c.key)}
                        className={`px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-[#003080] transition-colors ${c.cls ?? ""}`}
                      >
                        {c.label}
                        {sortKeyAlu === c.key && (sortDirAlu === "asc"
                          ? <ChevronUp className="inline h-3 w-3 ml-0.5" />
                          : <ChevronDown className="inline h-3 w-3 ml-0.5" />)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porAlumnoSorted.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-16 text-muted-foreground">Sin resultados</td></tr>
                  ) : porAlumnoSorted.map((a, i) => (
                    <tr
                      key={i}
                      className={
                        a.convalidante
                          ? "bg-amber-50 hover:bg-amber-100/70"
                          : (i % 2 === 0 ? "bg-white hover:bg-indigo-50/40" : "bg-gray-50/60 hover:bg-indigo-50/40")
                      }
                      title={a.cursosJaladosLista ? `Jalando: ${a.cursosJaladosLista}` : undefined}
                    >
                      <td className="px-3 py-1.5 max-w-[260px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate" title={a.alumno}>{a.alumno}</span>
                          {a.convalidante && (
                            <span
                              className="text-[9px] font-bold rounded px-1.5 py-px tracking-wider shrink-0"
                              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}
                            >
                              CONVALIDANTE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 hidden md:table-cell font-mono">{a.codAlumno}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell max-w-[220px] truncate" title={a.carrera}>
                        {a.carrera || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 hidden lg:table-cell text-center">{a.local}</td>
                      <td className="px-3 py-1.5 text-center font-semibold">{a.totalCursos}</td>
                      <td className="px-3 py-1.5 text-center">
                        {a.cursosJalando > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                            <BookX className="h-3.5 w-3.5" /> {a.cursosJalando}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">0</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell">{a.pctPromedio.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
