import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  CheckCircle2, AlertTriangle, Upload, RefreshCw,
  Users, FileSpreadsheet, PlusCircle, MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocenteItem {
  dni: string | number | null;
  nombre: string;
  programa?: string;
}

interface Resultado {
  enArchivo: number;
  enLista: number;
  faltanEnLista: DocenteItem[];   // in file but NOT in current list
  sobranEnLista: DocenteItem[];   // in current list but NOT in file
  fecha?: string;
  archivoNombre?: string;
}

export default function ComparacionFICA() {
  const [listaActual, setListaActual]   = useState<DocenteItem[]>([]);
  const [resultado, setResultado]       = useState<Resultado | null>(null);
  const [loading, setLoading]           = useState(false);
  const [dragging, setDragging]         = useState(false);
  const [errMsg, setErrMsg]             = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/docentes-fica-2026.json")
      .then((r) => r.json())
      .then((data: DocenteItem[]) => setListaActual(data))
      .catch(() => {});
  }, []);

  const normalize = (s: string) =>
    s.toUpperCase().trim().replace(/\s+/g, " ").replace(/,/g, "");

  const processFile = (file: File) => {
    if (!file) return;
    setLoading(true);
    setErrMsg("");
    setResultado(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });

        // Find "Planificación 2026-1" sheet or first sheet
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase().includes("planif")) ??
          wb.SheetNames[0];
        const sh = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sh, {
          defval: "",
          header: 1,
        });

        // Find header row (contains "Cod Facultad" or "DNI")
        let headerIdx = rows.findIndex((r) =>
          r.some((c) => typeof c === "string" && (c.includes("Cod Facultad") || c.includes("DNI")))
        );
        if (headerIdx < 0) headerIdx = 4;

        const header = rows[headerIdx] as string[];
        const colFac   = header.findIndex((h) => typeof h === "string" && h.toLowerCase().includes("cod facultad"));
        const colDNI   = header.findIndex((h) => typeof h === "string" && h.toLowerCase().includes("dni"));
        const colNom   = header.findIndex((h) => typeof h === "string" && h.toLowerCase().includes("apellidos"));
        const colProg  = header.findIndex((h) => typeof h === "string" && h.toLowerCase().includes("programa"));

        if (colFac < 0 || colNom < 0) {
          setErrMsg("No se encontró la columna de facultad o nombres. Verifica que el archivo sea la hoja de Planificación.");
          setLoading(false);
          return;
        }

        const dataRows = rows.slice(headerIdx + 1).filter((r) => {
          const fac  = (r[colFac] ?? "").toString().trim();
          const nom  = (r[colNom] ?? "").toString().trim();
          return fac === "FICA" && nom.length > 3;
        });

        // Unique by DNI
        const byDni   = new Map<string, DocenteItem>();
        const byNom   = new Map<string, DocenteItem>();
        dataRows.forEach((r) => {
          const dni  = (r[colDNI] ?? "").toString().trim();
          const nom  = (r[colNom] ?? "").toString().trim().toUpperCase();
          const prog = colProg >= 0 ? (r[colProg] ?? "").toString().trim() : "";
          if (dni) {
            if (!byDni.has(dni)) byDni.set(dni, { dni, nombre: nom, programa: prog });
          } else if (nom) {
            if (!byNom.has(nom)) byNom.set(nom, { dni: null, nombre: nom, programa: prog });
          }
        });
        const fromFile = [...byDni.values(), ...byNom.values()];

        // Build lookup sets from current list
        const actualDnis   = new Set(listaActual.filter((d) => d.dni).map((d) => d.dni!.toString()));
        const actualNoms   = new Set(listaActual.map((d) => normalize(d.nombre)));

        const fileDnis  = new Set(fromFile.filter((d) => d.dni).map((d) => d.dni!.toString()));
        const fileNoms  = new Set(fromFile.map((d) => normalize(d.nombre)));

        const faltanEnLista = fromFile.filter((d) => {
          if (d.dni && actualDnis.has(d.dni.toString())) return false;
          if (actualNoms.has(normalize(d.nombre))) return false;
          return true;
        });

        const sobranEnLista = listaActual.filter((d) => {
          if (d.dni && fileDnis.has(d.dni.toString())) return false;
          if (fileNoms.has(normalize(d.nombre))) return false;
          return true;
        });

        setResultado({
          enArchivo: fromFile.length,
          enLista: listaActual.length,
          faltanEnLista,
          sobranEnLista,
          fecha: new Date().toLocaleString("es-PE"),
          archivoNombre: file.name,
        });
      } catch {
        setErrMsg("Error al leer el archivo. Asegúrate de que sea un Excel (.xlsx) de planificación.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const perfect = resultado && resultado.faltanEnLista.length === 0 && resultado.sobranEnLista.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RefreshCw className="w-7 h-7 text-primary" />
          Comparación FICA — DATA CERRADA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verifica que la lista de {listaActual.length} docentes FICA coincida con cualquier versión del archivo DATA_CERRADA.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
        }`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
        <Upload className="w-10 h-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Arrastra aquí el archivo DATA_CERRADA</p>
          <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionarlo · Formato .xlsx</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Procesando archivo…
          </div>
        )}
      </div>

      {errMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          {errMsg}
        </div>
      )}

      {/* Result */}
      {resultado && (
        <div className="space-y-5">
          {/* Meta info */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="font-medium truncate max-w-xs">{resultado.archivoNombre}</span>
              <span>·</span>
              <span>{resultado.fecha}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="gap-2 h-8 text-xs"
            >
              <Upload className="w-3.5 h-3.5" /> Subir otro archivo
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "En archivo nuevo", value: resultado.enArchivo, icon: <FileSpreadsheet className="w-4 h-4" />, color: "text-primary bg-primary/10" },
              { label: "En lista actual", value: resultado.enLista, icon: <Users className="w-4 h-4" />, color: "text-indigo-600 bg-indigo-50" },
              { label: "Faltan en lista", value: resultado.faltanEnLista.length, icon: <PlusCircle className="w-4 h-4" />, color: resultado.faltanEnLista.length > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50" },
              { label: "No están en archivo", value: resultado.sobranEnLista.length, icon: <MinusCircle className="w-4 h-4" />, color: resultado.sobranEnLista.length > 0 ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50" },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                  {c.icon}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className="text-xl font-bold text-foreground">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Perfect match banner */}
          {perfect ? (
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-lg">¡Coincidencia perfecta!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Los {resultado.enArchivo} docentes FICA del archivo corresponden exactamente con la lista actual. No falta ni sobra ninguno.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                Se encontraron diferencias entre el archivo y la lista actual. Revisa los detalles a continuación.
              </p>
            </div>
          )}

          {/* Missing teachers (in file, not in list) */}
          {resultado.faltanEnLista.length > 0 && (
            <TeacherTable
              title="Docentes en el archivo que NO están en la lista actual"
              subtitle="Estos docentes aparecen en la planificación FICA pero faltan en el registro del portal."
              items={resultado.faltanEnLista}
              badgeLabel="Falta agregar"
              badgeColor="bg-red-50 text-red-700 border-red-200"
              iconColor="text-red-500"
            />
          )}

          {/* Extra teachers (in list, not in file) */}
          {resultado.sobranEnLista.length > 0 && (
            <TeacherTable
              title="Docentes en la lista actual que NO aparecen en el archivo"
              subtitle="Estos docentes están en el registro del portal pero no tienen carga en esta planificación FICA."
              items={resultado.sobranEnLista}
              badgeLabel="No está en planificación"
              badgeColor="bg-amber-50 text-amber-700 border-amber-200"
              iconColor="text-amber-500"
            />
          )}
        </div>
      )}

      {/* Instruction when no file loaded yet */}
      {!resultado && !loading && (
        <div className="text-center py-10 text-muted-foreground">
          <FileSpreadsheet className="w-12 h-12 mx-auto opacity-20 mb-3" />
          <p className="text-sm">Sube el archivo DATA_CERRADA para iniciar la comparación.</p>
          <p className="text-xs mt-1 opacity-70">
            Lista actual cargada: <strong className="text-foreground">{listaActual.length} docentes FICA</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function TeacherTable({
  title, subtitle, items, badgeLabel, badgeColor, iconColor,
}: {
  title: string; subtitle: string;
  items: DocenteItem[]; badgeLabel: string; badgeColor: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
      <div className="px-5 py-4 bg-muted/40 border-b border-border/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />
          <p className="font-semibold text-foreground text-sm">{title}</p>
          <Badge variant="outline" className={`ml-auto text-xs px-2 py-0 ${badgeColor}`}>
            {items.length} docente{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 pl-6">{subtitle}</p>
      </div>
      <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
        {items.map((d, i) => (
          <div key={i} className="grid grid-cols-[40px_120px_1fr_auto] items-center px-5 py-2.5 hover:bg-muted/30 transition-colors">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">{i + 1}</span>
            <span className="text-sm font-mono tabular-nums text-foreground">
              {d.dni ?? <span className="italic text-muted-foreground">—</span>}
            </span>
            <span className="text-sm font-medium text-foreground pr-4">{d.nombre}</span>
            <Badge variant="outline" className={`text-[10px] px-2 py-0 whitespace-nowrap ${badgeColor}`}>
              {badgeLabel}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
