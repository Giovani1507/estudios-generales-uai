import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import ExcelJS from "exceljs";
import { Clock, Users, BarChart2, Download, Search, Star } from "lucide-react";

interface PlanRow {
  carrera: string;
  ciclo: string;
  curso: string;
  docente: string;
  horasAcad: number;
}

interface DocenteTC {
  docente: string;
  totalHoras: number;
  ciclos: string[];
  carreras: string[];
  cursos: { ciclo: string; carrera: string; curso: string; horas: number }[];
  tieneCicloExtra: boolean;
}

export default function DocentesTC() {
  const [data, setData] = useState<DocenteTC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroCarrera, setFiltroCarrera] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${base}/planificacion-fica-2026-1.json`)
      .then((r) => r.json())
      .then((json: PlanRow[]) => {
        // 1. Docentes que dictan en ciclo 1 o 2
        const docsCiclo12 = new Set(
          json.filter((r) => r.ciclo === "1" || r.ciclo === "2").map((r) => r.docente)
        );

        // 2. Acumular TODAS sus horas (incluyendo otros ciclos)
        const map: Record<string, { horas: number; ciclos: Set<string>; carreras: Set<string>; cursos: DocenteTC["cursos"] }> = {};
        json.forEach((r) => {
          if (!docsCiclo12.has(r.docente)) return;
          if (!map[r.docente])
            map[r.docente] = { horas: 0, ciclos: new Set(), carreras: new Set(), cursos: [] };
          map[r.docente].horas += r.horasAcad;
          map[r.docente].ciclos.add(r.ciclo);
          map[r.docente].carreras.add(r.carrera);
          map[r.docente].cursos.push({ ciclo: r.ciclo, carrera: r.carrera, curso: r.curso, horas: r.horasAcad });
        });

        // 3. Filtrar TC: ≥ 29 horas
        const tc: DocenteTC[] = Object.entries(map)
          .filter(([, v]) => v.horas >= 29)
          .map(([docente, v]) => ({
            docente,
            totalHoras: v.horas,
            ciclos: [...v.ciclos].sort((a, b) => Number(a) - Number(b)),
            carreras: [...v.carreras].sort(),
            cursos: v.cursos,
            tieneCicloExtra: [...v.ciclos].some((c) => c !== "1" && c !== "2"),
          }))
          .sort((a, b) => b.totalHoras - a.totalHoras);

        setData(tc);
        setLoading(false);
      });
  }, []);

  const carreras = useMemo(() => [...new Set(data.flatMap((d) => d.carreras))].sort(), [data]);

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim();
    return data.filter((d) => {
      const matchQ = !q || d.docente.includes(q);
      const matchC = !filtroCarrera || d.carreras.includes(filtroCarrera);
      return matchQ && matchC;
    });
  }, [data, search, filtroCarrera]);

  const promedioHoras = useMemo(
    () => (data.length ? Math.round(data.reduce((s, d) => s + d.totalHoras, 0) / data.length) : 0),
    [data]
  );
  const conCicloExtra = useMemo(() => data.filter((d) => d.tieneCicloExtra).length, [data]);

  const barColor = (h: number) =>
    h >= 38 ? "bg-[#001F5F]" : h >= 33 ? "bg-blue-600" : "bg-blue-400";

  const handleExportExcel = async () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistema UAI";
    wb.created = new Date();
    const navy = "001F5F", gold = "C9A84C", white = "FFFFFF";
    const NCOLS = 7;
    const ws = wb.addWorksheet("Docentes TC FICA", { pageSetup: { paperSize: 9, orientation: "landscape" } });

    let logoId: number | null = null;
    try {
      const blob = await fetch(`${base}/escudo.png`).then((r) => r.blob());
      logoId = wb.addImage({ buffer: await blob.arrayBuffer(), extension: "png" });
    } catch (_) {}

    const heights = [4, 65, 22, 15, 13, 5];
    heights.forEach((h, i) => { ws.getRow(i + 1).height = h; });
    for (let rn = 1; rn <= 6; rn++)
      for (let c = 1; c <= NCOLS; c++)
        ws.getRow(rn).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };

    if (logoId !== null)
      ws.addImage(logoId, { tl: { col: 2.8, row: 1.1 }, ext: { width: 60, height: 60 } });

    const addTitle = (txt: string, row: number, bold: boolean, size: number, color = white) => {
      ws.mergeCells(row, 1, row, NCOLS);
      const cell = ws.getRow(row).getCell(1);
      cell.value = txt;
      cell.font = { bold, size, color: { argb: color }, name: "Arial" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    };
    addTitle("UNIVERSIDAD AUTÓNOMA DE ICA", 3, true, 16);
    addTitle("Docentes Tiempo Completo (TC) — FICA 2026-I  ·  Criterio: ≥ 29 horas académicas", 4, false, 11, "AABBD4");
    addTitle(
      `Generado: ${new Date().toLocaleDateString("es-PE")}  ·  Total TC: ${filtered.length}  ·  Incluye horas en todos los ciclos`,
      5, false, 10, "AABBD4"
    );
    for (let c = 1; c <= NCOLS; c++)
      ws.getRow(6).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: gold } };

    const COLS = ["#", "Docente", "Total Horas", "Ciclos que dicta", "Carreras", "Carga extra (>ciclo 2)", "Clasificación"];
    const WIDTHS = [5, 36, 13, 18, 20, 22, 14];
    COLS.forEach((h, i) => { ws.getColumn(i + 1).width = WIDTHS[i]; });
    const hr = ws.getRow(7); hr.height = 18;
    COLS.forEach((h, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: white }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin", color: { argb: gold } }, bottom: { style: "thin", color: { argb: gold } } };
    });

    filtered.forEach((d, i) => {
      const row = ws.getRow(8 + i); row.height = 14;
      const bg = i % 2 === 0 ? "FFFFFF" : "EEF3FF";
      const ciclosExtra = d.ciclos.filter((c) => c !== "1" && c !== "2");
      const vals = [
        i + 1, d.docente, d.totalHoras, d.ciclos.join(", "), d.carreras.join(", "),
        ciclosExtra.length ? `Ciclos: ${ciclosExtra.join(", ")}` : "—",
        d.totalHoras >= 38 ? "TC Alto" : d.totalHoras >= 33 ? "TC" : "TC Mínimo",
      ];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font = { size: 9, bold: ci === 1 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { vertical: "middle", horizontal: [0, 2].includes(ci) ? "center" : "left" };
        cell.border = { bottom: { style: "hair", color: { argb: "CCCCDD" } } };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `docentes-tc-fica-2026-1.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#001F5F]">Docentes Tiempo Completo — FICA</h1>
            <p className="text-sm text-gray-500 mt-1">
              Docentes de ciclos 1 y 2 con{" "}
              <span className="font-semibold text-[#001F5F]">≥ 29 horas académicas</span> en total
              (incluyendo sus horas en otros ciclos)
            </p>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Star className="w-5 h-5" />, label: "Docentes TC", value: data.length, color: "text-[#001F5F]", bg: "bg-blue-50 border-blue-200" },
            { icon: <Clock className="w-5 h-5" />, label: "Promedio Horas", value: promedioHoras, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
            { icon: <BarChart2 className="w-5 h-5" />, label: "Con carga extra (>ciclo 2)", value: conCicloExtra, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
            { icon: <Users className="w-5 h-5" />, label: "Carreras involucradas", value: carreras.length, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} className={`border rounded-2xl p-4 shadow-sm ${bg}`}>
              <div className={`mb-1 ${color}`}>{icon}</div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{loading ? "…" : value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar docente…"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30"
            />
          </div>
          <select
            value={filtroCarrera}
            onChange={(e) => setFiltroCarrera(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30"
          >
            <option value="">Todas las carreras</option>
            {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || filtroCarrera) && (
            <button
              onClick={() => { setSearch(""); setFiltroCarrera(""); }}
              className="text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
            >
              Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500 font-medium">{filtered.length} docentes TC</span>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-[#001F5F]/20">
          <div className="bg-[#001F5F] px-4 py-2.5 flex items-center justify-between">
            <span className="text-white text-xs font-bold uppercase tracking-wider">
              Docentes Tiempo Completo — FICA 2026-I
            </span>
            <div className="flex gap-4 items-center text-[11px]">
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="w-2.5 h-2.5 rounded-full bg-[#001F5F] border-2 border-white inline-block" /> ≥ 38 h
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> 33–37 h
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-300 inline-block" /> 29–32 h
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white">
              <div className="w-6 h-6 border-2 border-[#001F5F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 bg-white text-gray-400 text-sm">Sin resultados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#001F5F]">
                    {["#", "Docente", "Horas", "Ciclos", "Carreras", "Carga extra"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-0 ${i === 1 ? "text-left" : "text-center"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                  <tr><td colSpan={6} className="p-0"><div className="h-[3px] bg-[#C9A84C]" /></td></tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const isEven = i % 2 === 0;
                    const isExp = expandido === d.docente;
                    const ciclosExtra = d.ciclos.filter((c) => c !== "1" && c !== "2");
                    const pct = Math.min(100, Math.round((d.totalHoras / 40) * 100));

                    return (
                      <>
                        <tr
                          key={d.docente}
                          className={`${isEven ? "bg-white" : "bg-[#f0f4ff]"} border-b border-[#001F5F]/8 hover:bg-[#001F5F]/5 transition-colors cursor-pointer`}
                          onClick={() => setExpandido(isExp ? null : d.docente)}
                        >
                          <td className="px-3 py-2.5 text-center text-xs font-bold text-[#001F5F]/40 border-r border-[#001F5F]/8 w-10">{i + 1}</td>

                          <td className="px-3 py-2.5 border-r border-[#001F5F]/8 min-w-[220px]">
                            <span className="font-semibold text-[#001F5F] text-[12px]">{d.docente}</span>
                          </td>

                          <td className="px-3 py-2 border-r border-[#001F5F]/8 w-28 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-extrabold text-base ${d.totalHoras >= 38 ? "text-[#001F5F]" : d.totalHoras >= 33 ? "text-blue-600" : "text-blue-400"}`}>
                                {d.totalHoras}
                              </span>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${barColor(d.totalHoras)}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-center border-r border-[#001F5F]/8">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {d.ciclos.map((c) => (
                                <span
                                  key={c}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    c === "1" || c === "2"
                                      ? "bg-[#001F5F] text-white"
                                      : "bg-amber-100 text-amber-800 border border-amber-300"
                                  }`}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-center border-r border-[#001F5F]/8">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {d.carreras.map((c) => (
                                <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{c}</span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            {ciclosExtra.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                                ⚠ ciclos {ciclosExtra.join(", ")}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </td>
                        </tr>

                        {isExp && (
                          <tr key={`${d.docente}-detail`} className="bg-[#f8faff] border-b border-[#001F5F]/10">
                            <td colSpan={6} className="px-6 py-3">
                              <p className="text-[11px] font-bold text-[#001F5F] mb-2 uppercase tracking-wide">
                                Detalle de cursos — {d.docente}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                {[...d.cursos]
                                  .sort((a, b) => Number(a.ciclo) - Number(b.ciclo))
                                  .map((c, ci) => (
                                    <div
                                      key={ci}
                                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                                        c.ciclo === "1" || c.ciclo === "2"
                                          ? "border-blue-200 bg-blue-50"
                                          : "border-amber-200 bg-amber-50"
                                      }`}
                                    >
                                      <span className={`font-bold w-14 shrink-0 ${c.ciclo === "1" || c.ciclo === "2" ? "text-[#001F5F]" : "text-amber-700"}`}>
                                        Ciclo {c.ciclo}
                                      </span>
                                      <span className="text-gray-500 w-8 shrink-0">[{c.carrera}]</span>
                                      <span className="text-gray-700 flex-1 truncate">{c.curso}</span>
                                      <span className="font-semibold text-gray-600 shrink-0">{c.horas}h</span>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <div className="bg-[#001F5F]/5 border-t border-[#001F5F]/10 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {filtered.length} docentes TC · Haz clic en una fila para ver el detalle de cursos
              </span>
              <span className="text-xs font-semibold text-[#001F5F]">
                Criterio: ≥ 29 horas académicas · Semestre 2026-I
              </span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
