import { Router, Request, Response } from "express";
import path from "path";
import { readFileSync } from "fs";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { users } from "@workspace/db";

const router = Router();

// --- Data cache ---
let _fcsData: Record<string, unknown>[] | null = null;
let _ficaData: Record<string, unknown>[] | null = null;

function getFCSData() {
  if (!_fcsData) {
    const p = path.resolve(process.cwd(), "../school-portal/public/planificacion-fcs-2026-1.json");
    _fcsData = JSON.parse(readFileSync(p, "utf-8"));
  }
  return _fcsData!;
}

function getFICAData() {
  if (!_ficaData) {
    const p = path.resolve(process.cwd(), "../school-portal/public/planificacion-fica-2026-1.json");
    _ficaData = JSON.parse(readFileSync(p, "utf-8"));
  }
  return _ficaData!;
}

const PROG_NAMES: Record<string, string> = {
  EN: "Enfermería", OB: "Obstetricia", PS: "Psicología",
  MH: "Medicina Humana", T1: "Tecnología Médica I", T2: "Tecnología Médica II",
  T3: "Tecnología Médica III", T4: "Tecnología Médica IV",
};
const CARRERA_NAMES: Record<string, string> = {
  IS: "Ing. de Sistemas", IN: "Ing. Industrial", IC: "Ing. Civil",
  DE: "Derecho", AR: "Arquitectura", AE: "Adm. de Empresa",
};

async function buildDataContext(): Promise<string> {
  const fcs = getFCSData() as any[];
  const fica = getFICAData() as any[];

  // --- FCS stats ---
  const fcsAllDocentes = new Set<string>();
  const fcsDocentesBySede: Record<string, Set<string>> = {};
  const fcsDocentesByPrograma: Record<string, Set<string>> = {};
  const fcsByCiclo: Record<string, number> = {};
  const fcsDocentesByCiclo: Record<string, Set<string>> = {};

  fcs.forEach((r) => {
    if (r.docente) {
      fcsAllDocentes.add(r.docente);
      if (r.local) {
        if (!fcsDocentesBySede[r.local]) fcsDocentesBySede[r.local] = new Set();
        fcsDocentesBySede[r.local].add(r.docente);
      }
      if (r.programa) {
        if (!fcsDocentesByPrograma[r.programa]) fcsDocentesByPrograma[r.programa] = new Set();
        fcsDocentesByPrograma[r.programa].add(r.docente);
      }
      if (r.ciclo) {
        if (!fcsDocentesByCiclo[r.ciclo]) fcsDocentesByCiclo[r.ciclo] = new Set();
        fcsDocentesByCiclo[r.ciclo].add(r.docente);
      }
    }
    if (r.ciclo) fcsByCiclo[r.ciclo] = (fcsByCiclo[r.ciclo] || 0) + 1;
  });

  const fcsCiclo12Docentes = new Set([
    ...(fcsDocentesByCiclo["1"] || []),
    ...(fcsDocentesByCiclo["2"] || []),
  ]);

  // --- FICA stats ---
  const ficaAllDocentes = new Set<string>();
  const ficaByCarrera: Record<string, Set<string>> = {};
  const ficaByTurno: Record<string, number> = {};
  const ficaByCiclo: Record<string, Set<string>> = {};

  fica.forEach((r) => {
    if (r.docente) {
      ficaAllDocentes.add(r.docente);
      if (r.carrera) {
        if (!ficaByCarrera[r.carrera]) ficaByCarrera[r.carrera] = new Set();
        ficaByCarrera[r.carrera].add(r.docente);
      }
      if (r.ciclo != null) {
        const k = String(r.ciclo);
        if (!ficaByCiclo[k]) ficaByCiclo[k] = new Set();
        ficaByCiclo[k].add(r.docente);
      }
    }
    if (r.turno) ficaByTurno[r.turno] = (ficaByTurno[r.turno] || 0) + 1;
  });

  // --- DB stats ---
  let dbInfo = "No disponible";
  try {
    const userRows = await db.select().from(users);
    const byRole: Record<string, number> = {};
    userRows.forEach((u) => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
    dbInfo = `Total: ${userRows.length} usuarios\n${Object.entries(byRole).map(([r, c]) => `  · ${r}: ${c}`).join("\n")}`;
  } catch {}

  return `=== DATOS REALES DEL SISTEMA — Portal Académico UAI — Semestre 2026-1 ===

FACULTAD DE CIENCIAS DE LA SALUD (FCS):
- Total registros de planificación cargados: ${fcs.length}
- Total docentes únicos (todos los ciclos): ${fcsAllDocentes.size}
- Docentes en Ciclos 1 y 2 (Estudios Generales): ${fcsCiclo12Docentes.size}
- Ciclos disponibles: ${Object.keys(fcsByCiclo).sort((a, b) => Number(a) - Number(b)).join(", ")}
- Docentes únicos por sede:
${Object.entries(fcsDocentesBySede).map(([k, v]) => `  · ${k}: ${v.size} docentes`).join("\n")}
- Docentes únicos por programa:
${Object.entries(fcsDocentesByPrograma).map(([k, v]) => `  · ${k} (${PROG_NAMES[k] || k}): ${v.size} docentes`).join("\n")}
- Docentes únicos por ciclo:
${Object.entries(fcsDocentesByCiclo).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `  · Ciclo ${k}: ${v.size} docentes`).join("\n")}

FACULTAD DE ING., CIENCIAS Y ADMINISTRACIÓN (FICA):
- Total registros de horarios cargados: ${fica.length}
- Total docentes únicos: ${ficaAllDocentes.size}
- Docentes únicos por carrera:
${Object.entries(ficaByCarrera).map(([k, v]) => `  · ${k} (${CARRERA_NAMES[k] || k}): ${v.size} docentes`).join("\n")}
- Docentes únicos por ciclo:
${Object.entries(ficaByCiclo).map(([k, v]) => `  · Ciclo ${k}: ${v.size} docentes`).join("\n")}
- Sesiones registradas por turno:
${Object.entries(ficaByTurno).map(([k, v]) => `  · ${k}: ${v} sesiones`).join("\n")}

USUARIOS DEL SISTEMA (base de datos):
${dbInfo}

INFORMACIÓN INSTITUCIONAL:
- Universidad: Universidad Autónoma de Ica (UAI)
- Semestre activo: 2026-1
- Sistema: Portal Académico — Departamento de Estudios Generales
- Los datos de planificación cubren Ciclos 1 y 2 únicamente (Estudios Generales)
- FCS: Facultad de Ciencias de la Salud
- FICA: Facultad de Ingeniería, Ciencias y Administración
`;
}

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de la Universidad Autónoma de Ica (UAI), representado por el delfín mascota institucional. Tu nombre es "Ichi" y eres amigable, profesional y preciso.

REGLAS ABSOLUTAS — NUNCA VIOLARLAS:
1. SOLO responde con información que aparezca EXACTAMENTE en los datos del sistema proporcionados.
2. Si no encuentras el dato, responde: "No encontré esa información exacta en los datos disponibles del sistema."
3. JAMÁS inventes, estimes, supongas ni aproximes cantidades, costos, nombres o datos.
4. JAMÁS respondas preguntas sobre costos o trámites si no están en los datos.
5. Si la consulta es ambigua, pide aclaración antes de responder.
6. Responde en español, con tono amable, claro y profesional.
7. Mantén respuestas breves y directas. Si el usuario pide más detalle, amplía.
8. Si la pregunta es completamente ajena al sistema UAI, di: "Solo puedo ayudarte con información del Portal Académico UAI."
9. Cuando respondas con números, asegúrate de que coincidan exactamente con los datos.`;

// POST /api/assistant/chat
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mensaje requerido." });
    }

    const dataContext = await buildDataContext();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `DATOS ACTUALES DEL SISTEMA:\n${dataContext}\n\nPREGUNTA: ${message.trim()}`,
        },
      ],
    });

    const block = response.content[0];
    const reply = block.type === "text" ? block.text : "Lo siento, no pude procesar tu consulta.";

    return res.json({ reply });
  } catch (err) {
    console.error("[Assistant] Error:", err);
    return res.status(500).json({ error: "Error interno al procesar tu consulta. Intenta de nuevo." });
  }
});

export default router;
