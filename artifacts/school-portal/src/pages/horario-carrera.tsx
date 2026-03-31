import React, { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Monitor, MapPin, Users } from "lucide-react";

interface FCSRow {
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  modalidadCurso: string;
  horasT: number;
  horasP: number;
  horas: number;
  docente: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  horasAcad: number;
}

const CARRERAS: Record<string, string> = {
  EN: "Enfermería",
  OB: "Obstetricia",
  PS: "Psicología",
};

const DIA_ORDER: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, MIÉRCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6, SÁBADO: 6, DOMINGO: 7,
};

function modalidadBadge(m: string) {
  const norm = m.toUpperCase().trim();
  if (norm.includes("VIRTUAL"))
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">Virtual</Badge>;
  if (norm.includes("HIBRIDO") || norm.includes("HÍBRIDO"))
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">Híbrido</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">Presencial</Badge>;
}

function tipoBadge(t: string) {
  if (t === "T")
    return <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">T</span>;
  if (t === "P")
    return <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">P</span>;
  return <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{t}</span>;
}

function normDia(d: string) {
  return d.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function HorarioCarrera() {
  const [data, setData] = useState<FCSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrera, setCarrera] = useState("EN");
  const [ciclo, setCiclo] = useState("1");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fcs-2026-1.json`)
      .then((r) => r.json())
      .then((d: FCSRow[]) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .filter(
        (r) =>
          r.carrera === carrera &&
          r.ciclo === ciclo &&
          (!q ||
            r.curso.toLowerCase().includes(q) ||
            r.docente.toLowerCase().includes(q) ||
            r.seccion.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const ca = a.curso.localeCompare(b.curso, "es");
        if (ca !== 0) return ca;
        return a.seccion.localeCompare(b.seccion, "es");
      });
  }, [data, carrera, ciclo, search]);

  // Group by curso → list of sections
  const grouped = useMemo(() => {
    const map = new Map<string, { codigo: string; curso: string; rows: FCSRow[] }>();
    filtered.forEach((r) => {
      const key = r.codigo + "|" + r.curso;
      if (!map.has(key)) map.set(key, { codigo: r.codigo, curso: r.curso, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.curso.localeCompare(b.curso, "es")
    );
  }, [filtered]);

  const totalDocentes = useMemo(
    () => new Set(filtered.map((r) => r.docente)).size,
    [filtered]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Horarios por Carrera — FCS</h1>
          <p className="text-sm text-muted-foreground">
            Planificación 2026-1 · Sede Principal · Ciclos 1 y 2
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[160px] max-w-[220px]">
          <Select value={carrera} onValueChange={setCarrera}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CARRERAS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[120px]">
          <Select value={ciclo} onValueChange={setCiclo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Ciclo 1</SelectItem>
              <SelectItem value="2">Ciclo 2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar curso o docente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="flex gap-3 ml-auto text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <b className="text-foreground">{grouped.length}</b> cursos
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <b className="text-foreground">{totalDocentes}</b> docentes
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <b className="text-foreground">{filtered.length}</b> secciones
          </span>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No se encontraron cursos para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ codigo, curso, rows }) => (
            <Card key={codigo + curso} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground leading-snug">
                      {curso}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{codigo}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {rows.length} secc.
                    </Badge>
                    {/* Unique modalidades */}
                    {[...new Set(rows.map((r) => r.modalidad.toUpperCase().trim()))].map((m) => (
                      <span key={m}>{modalidadBadge(m)}</span>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-16">Secc.</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-8">Tipo</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Docente</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Modalidad</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Día</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-32">Horario</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground w-16">Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .sort((a, b) => {
                          const sa = a.seccion.localeCompare(b.seccion, "es");
                          if (sa !== 0) return sa;
                          const da = DIA_ORDER[normDia(a.dia)] || 9;
                          const db = DIA_ORDER[normDia(b.dia)] || 9;
                          if (da !== db) return da - db;
                          return a.hora.localeCompare(b.hora);
                        })
                        .map((r, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                              i % 2 === 0 ? "" : "bg-muted/10"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono font-semibold text-xs text-primary">
                              {r.seccion}
                            </td>
                            <td className="px-3 py-2.5">{tipoBadge(r.tipo)}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                              {r.docente || <span className="text-muted-foreground italic">Sin asignar</span>}
                            </td>
                            <td className="px-3 py-2.5">{modalidadBadge(r.modalidad)}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                              {r.dia
                                ? r.dia.charAt(0) + r.dia.slice(1).toLowerCase()
                                : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono text-foreground">
                              {r.hora && r.horaFin ? `${r.hora} – ${r.horaFin}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                              {r.horasAcad || r.horas}h
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
