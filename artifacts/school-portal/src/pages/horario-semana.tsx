import { useState, useEffect, useMemo } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Search, X, Clock, BookOpen, User, Loader2, DoorOpen, FlaskConical, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const DIAS_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DIAS_LABEL: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};
const DIA_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  LUNES:     { bg: "#EFF6FF", text: "#1d4ed8", border: "#bfdbfe" },
  MARTES:    { bg: "#F0FDF4", text: "#15803d", border: "#bbf7d0" },
  MIERCOLES: { bg: "#FFF7ED", text: "#c2410c", border: "#fed7aa" },
  JUEVES:    { bg: "#FDF4FF", text: "#7e22ce", border: "#e9d5ff" },
  VIERNES:   { bg: "#FFF1F2", text: "#be123c", border: "#fecdd3" },
  SABADO:    { bg: "#F0FDFA", text: "#0f766e", border: "#99f6e4" },
  DOMINGO:   { bg: "#FEFCE8", text: "#a16207", border: "#fef08a" },
};
const MODAL_COLOR: Record<string, string> = {
  "PRESENCIAL":        "#15803d",
  "VIRTUAL":           "#1d4ed8",
  "HIBRIDO VIRTUAL":   "#7e22ce",
  "SEMIPRESENCIAL":    "#c2410c",
};

interface Row {
  local: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  modalidadCurso: string;
  docente: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  pabellon?: string;
  aula?: string;
  laboratorio?: string;
  facultad: "FICA" | "FCS";
}

function padH(h: string) {
  return h.replace(/^(\d):/, "0$1:");
}
function toMinutes(h: string) {
  const [hh, mm] = padH(h).split(":").map(Number);
  return hh * 60 + (mm || 0);
}

export default function HorarioSemana() {
  const [allData,   setAllData]   = useState<Row[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [facultad,  setFacultad]  = useState("TODAS");
  const [local,     setLocal]     = useState("TODOS");
  const [ciclo,     setCiclo]     = useState("1Y2");
  const [diaFiltro, setDiaFiltro] = useState("TODOS");
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.json()),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r  => r.json()),
    ]).then(([fica, fcs]) => {
      const ficaRows = (fica as Omit<Row, "facultad">[]).map(r => ({ ...r, facultad: "FICA" as const }));
      const fcsRows  = (fcs  as Omit<Row, "facultad">[]).map(r => ({ ...r, facultad: "FCS"  as const }));
      setAllData([...ficaRows, ...fcsRows]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const locales = useMemo(() => {
    const base = allData.filter(r => facultad === "TODAS" || r.facultad === facultad);
    return ["TODOS", ...Array.from(new Set(base.map(r => r.local))).sort()];
  }, [allData, facultad]);

  const ciclos = useMemo(() => {
    const base = allData.filter(r =>
      (facultad === "TODAS" || r.facultad === facultad) &&
      (local    === "TODOS" || r.local    === local)
    );
    return ["1Y2", "1", "2", ...Array.from(new Set(base.map(r => r.ciclo)))
      .filter(c => c !== "1" && c !== "2")
      .sort((a, b) => Number(a) - Number(b))];
  }, [allData, facultad, local]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allData.filter(r => {
      if (facultad  !== "TODAS" && r.facultad !== facultad)  return false;
      if (local     !== "TODOS" && r.local    !== local)     return false;
      if (ciclo === "1Y2") {
        if (r.ciclo !== "1" && r.ciclo !== "2") return false;
      } else if (ciclo !== "TODOS" && r.ciclo !== ciclo) {
        return false;
      }
      if (diaFiltro !== "TODOS" && r.dia !== diaFiltro) return false;
      if (q) {
        const hay = `${r.carreraFull} ${r.seccion} ${r.curso} ${r.docente} ${r.ciclo} ${r.local}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allData, facultad, local, ciclo, diaFiltro, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    DIAS_ORDER.forEach(d => map.set(d, []));
    for (const r of filtered) {
      if (!map.has(r.dia)) map.set(r.dia, []);
      map.get(r.dia)!.push(r);
    }
    map.forEach((rows, day) => {
      rows.sort((a, b) => toMinutes(a.hora) - toMinutes(b.hora));
      map.set(day, rows);
    });
    return map;
  }, [filtered]);

  const diasConClases  = DIAS_ORDER.filter(d => (byDay.get(d) ?? []).length > 0);
  const totalDocentes  = new Set(filtered.map(r => r.docente)).size;
  const totalCarreras  = new Set(filtered.map(r => r.carreraFull)).size;

  const printHorario = async () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const logoUrl = `${window.location.origin}${base}/logo-uai.png`;

    let logoData = "";
    try {
      const res  = await fetch(logoUrl);
      const blob = await res.blob();
      logoData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { logoData = ""; }

    const filterLabel = [
      facultad  !== "TODAS" ? `Facultad: ${facultad}` : null,
      local     !== "TODOS" ? `Local: ${local}`        : null,
      ciclo === "1Y2"       ? "Ciclos 1 y 2 (EE.GG)"
        : ciclo !== "TODOS" ? `Ciclo: ${ciclo}`        : null,
      diaFiltro !== "TODOS" ? `Día: ${DIAS_LABEL[diaFiltro]}` : null,
    ].filter(Boolean).join(" · ") || "Todos los filtros";

    const diasHtml = diasConClases.map(dia => {
      const rows = byDay.get(dia) ?? [];
      const col  = DIA_COLOR[dia] ?? { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" };
      const rowsHtml = rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
          <td style="padding:6px 8px;white-space:nowrap;font-weight:700;color:${col.text};font-size:10px;">
            ${padH(r.hora)}<br/><span style="font-weight:400;color:#94a3b8;">↓</span><br/>${padH(r.horaFin)}
          </td>
          <td style="padding:6px 8px;font-size:10px;">
            <span style="background:#001F5F;color:white;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">${r.carreraFull}</span>
            <span style="background:#C9A84C;color:#001F5F;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">Ciclo ${r.ciclo} · ${r.seccion}</span>
          </td>
          <td style="padding:6px 8px;font-size:10px;font-weight:600;">${r.curso} <span style="color:#94a3b8;font-weight:400;">(${r.tipo})</span></td>
          <td style="padding:6px 8px;font-size:10px;color:#475569;">${r.docente}</td>
          <td style="padding:6px 8px;font-size:10px;">
            ${r.aula ? `<span style="background:#fef9c3;color:#854d0e;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;border:1px solid #fde68a;">${r.aula}</span>` : ""}
            ${r.laboratorio ? `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;border:1px solid #6ee7b7;margin-left:2px;">${r.laboratorio}</span>` : ""}
            ${!r.aula && !r.laboratorio ? `<span style="color:#94a3b8;font-size:9px;">${r.modalidad}</span>` : ""}
          </td>
          <td style="padding:6px 8px;font-size:9px;color:#94a3b8;">${r.local}</td>
        </tr>`).join("");

      return `
        <div style="margin-bottom:20px;break-inside:avoid;">
          <div style="background:${col.text};color:white;padding:8px 14px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:800;font-size:13px;">${DIAS_LABEL[dia]}</span>
            <span style="background:white;color:${col.text};padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;">${rows.length} clase${rows.length !== 1 ? "s" : ""}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid ${col.border};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
            <thead>
              <tr style="background:${col.bg};">
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">HORA</th>
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">CARRERA / CICLO</th>
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">CURSO</th>
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">DOCENTE</th>
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">AULA / LAB</th>
                <th style="padding:5px 8px;text-align:left;font-size:9px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">LOCAL</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Horario por Semana · UAI 2026-I</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; background: white; color: #1e293b; }
    @media print {
      body { padding: 12px; }
      @page { margin: 1cm; size: A4 landscape; }
    }
    .no-print { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background:#001F5F;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #001F5F;">
    ${logoData ? `<img src="${logoData}" style="height:52px;width:auto;object-fit:contain;flex-shrink:0;" alt="UAI" />` : ""}
    <div>
      <h1 style="font-size:18px;font-weight:900;color:#001F5F;">HORARIO POR SEMANA · 2026-I</h1>
      <p style="font-size:11px;color:#64748b;margin-top:2px;">Universidad Autónoma de Ica · Filtros: ${filterLabel}</p>
      <p style="font-size:10px;color:#94a3b8;">Total: ${filtered.length} clases · ${diasConClases.length} días · ${totalDocentes} docentes · ${totalCarreras} carreras</p>
    </div>
  </div>
  ${diasHtml}
  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;">Generado el ${new Date().toLocaleDateString("es-PE", { day:"2-digit", month:"long", year:"numeric" })}</p>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando horarios...
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>Horario por Semana</h1>
          <p className="text-xs text-muted-foreground">Vista semanal de clases · 2026-I</p>
        </div>
        <Button
          size="sm"
          className="ml-auto text-white font-semibold"
          style={{ background: NAVY }}
          onClick={printHorario}
          disabled={diasConClases.length === 0}
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir / PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clases",       value: filtered.length,      color: NAVY       },
          { label: "Días activos", value: diasConClases.length, color: "#1d4ed8"  },
          { label: "Docentes",     value: totalDocentes,        color: "#7e22ce"  },
          { label: "Carreras",     value: totalCarreras,        color: "#059669"  },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select value={facultad} onValueChange={v => { setFacultad(v); setLocal("TODOS"); setCiclo("TODOS"); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Facultad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las facultades</SelectItem>
                <SelectItem value="FICA">FICA</SelectItem>
                <SelectItem value="FCS">FCS</SelectItem>
              </SelectContent>
            </Select>

            <Select value={local} onValueChange={v => { setLocal(v); setCiclo("TODOS"); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Local" />
              </SelectTrigger>
              <SelectContent>
                {locales.map(l => (
                  <SelectItem key={l} value={l}>{l === "TODOS" ? "Todos los locales" : l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ciclo} onValueChange={setCiclo}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent>
                {ciclos.map(c => (
                  <SelectItem key={c} value={c}>
                    {c === "1Y2"  ? "Ciclos 1 y 2 (EE.GG)"
                     : c === "TODOS" ? "Todos los ciclos"
                     : `Ciclo ${c}`}
                  </SelectItem>
                ))}
                <SelectItem value="TODOS">Todos los ciclos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={diaFiltro} onValueChange={setDiaFiltro}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los días</SelectItem>
                {DIAS_ORDER.map(d => (
                  <SelectItem key={d} value={d}>{DIAS_LABEL[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-white h-9">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Carrera, curso, docente..."
                className="text-xs outline-none flex-1 bg-transparent min-w-0"
              />
              {search && (
                <X className="w-3.5 h-3.5 cursor-pointer text-muted-foreground flex-shrink-0"
                   onClick={() => setSearch("")} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {diasConClases.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No se encontraron clases con los filtros seleccionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {diasConClases.map(dia => {
            const rows = byDay.get(dia) ?? [];
            const col  = DIA_COLOR[dia] ?? { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
            return (
              <Card key={dia} className="shadow-sm overflow-hidden" style={{ borderColor: col.border }}>
                <CardHeader
                  className="py-3 px-5 flex flex-row items-center gap-3"
                  style={{ background: col.bg, borderBottom: `1px solid ${col.border}` }}
                >
                  <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: col.text }} />
                  <CardTitle className="text-sm font-bold m-0" style={{ color: col.text }}>
                    {DIAS_LABEL[dia]}
                  </CardTitle>
                  <span
                    className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: col.text, color: "white" }}
                  >
                    {rows.length} clase{rows.length !== 1 ? "s" : ""}
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {rows.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div
                          className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-2 min-w-[76px] text-center"
                          style={{ background: col.bg, border: `1px solid ${col.border}` }}
                        >
                          <Clock className="w-3 h-3 mb-0.5" style={{ color: col.text }} />
                          <span className="text-[11px] font-bold leading-tight" style={{ color: col.text }}>
                            {padH(r.hora)}
                          </span>
                          <span className="text-[9px] text-slate-400">↓</span>
                          <span className="text-[11px] font-bold leading-tight" style={{ color: col.text }}>
                            {padH(r.horaFin)}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
                              style={{ background: NAVY }}
                            >
                              {r.carreraFull.length > 32
                                ? r.carreraFull.split(" ").slice(0, 4).join(" ")
                                : r.carreraFull}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                              style={{ background: GOLD, color: NAVY }}
                            >
                              Ciclo {r.ciclo} · {r.seccion}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                              style={{
                                background: `${MODAL_COLOR[r.modalidad] ?? "#64748b"}22`,
                                color: MODAL_COLOR[r.modalidad] ?? "#64748b",
                              }}
                            >
                              {r.modalidad}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase">{r.facultad}</span>
                          </div>

                          <div className="flex items-center gap-1 mb-0.5">
                            <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <p className="text-xs font-semibold text-slate-700 truncate">{r.curso}</p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">({r.tipo})</span>
                          </div>

                          <div className="flex items-center gap-1 mb-0.5">
                            <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <p className="text-xs text-slate-500 truncate">{r.docente}</p>
                            <span
                              className="ml-auto text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 text-slate-500"
                              style={{ background: "#f1f5f9" }}
                            >
                              {r.local}
                            </span>
                          </div>

                          {(r.aula || r.laboratorio) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {r.aula && (
                                <span
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                                  style={{ background: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" }}
                                >
                                  <DoorOpen className="w-3 h-3" />
                                  {r.aula}
                                </span>
                              )}
                              {r.laboratorio && (
                                <span
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                                  style={{ background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" }}
                                >
                                  <FlaskConical className="w-3 h-3" />
                                  {r.laboratorio}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
