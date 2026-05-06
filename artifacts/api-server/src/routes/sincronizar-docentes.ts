import { Router } from "express";
import { db } from "@workspace/db";
import { docentesExternosTable } from "@workspace/db/schema";
import { sql, ilike, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { Agent, fetch as undiciFetch } from "undici";

const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

const router = Router();

const EXTERNAL_API = "https://intranet.autonomadeica.edu.pe/admin/reporte-docentes/get";
const PAGE_SIZE = 1000;

interface ExternalDocente {
  id: string;
  name: string;
  username: string;
  career: string | null;
  faculty: string | null;
  sections: number;
  academicDepartment: string | null;
  text: string | null;
  locked: boolean;
}

async function fetchAllDocentes(cookie: string, termId: string): Promise<ExternalDocente[]> {
  const all: ExternalDocente[] = [];
  let start = 0;
  let totalRecords = Infinity;

  while (start < totalRecords) {
    const params = new URLSearchParams({
      draw: "1",
      start: String(start),
      length: String(PAGE_SIZE),
      search: "",
      termId,
      academicDepartment: "0",
      _: String(Date.now()),
    });

    const res = await undiciFetch(`${EXTERNAL_API}?${params.toString()}`, {
      dispatcher: tlsAgent,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://intranet.autonomadeica.edu.pe/",
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("AUTH_EXPIRED");
    }
    if (!res.ok) {
      throw new Error(`HTTP_ERROR_${res.status}`);
    }

    const json: any = await res.json();

    if (!json || !Array.isArray(json.data)) {
      throw new Error("INVALID_RESPONSE");
    }

    totalRecords = json.recordsTotal ?? json.recordsFiltered ?? json.data.length;
    all.push(...json.data);

    if (json.data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return all;
}

export async function sincronizarDocentes(cookie: string, termId: string) {
  const data = await fetchAllDocentes(cookie, termId);

  let nuevos = 0;
  let actualizados = 0;

  for (const doc of data) {
    if (!doc.username?.trim()) continue;

    const values = {
      username:  doc.username.trim(),
      name:      (doc.name || "").trim().toUpperCase(),
      career:    doc.career?.trim() || null,
      faculty:   doc.faculty?.trim() || null,
      sections:  doc.sections ?? null,
      rawData:   doc as any,
      updatedAt: new Date(),
    };

    const existing = await db
      .select({ id: docentesExternosTable.id })
      .from(docentesExternosTable)
      .where(sql`${docentesExternosTable.username} = ${values.username}`)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(docentesExternosTable).values({ ...values, syncedAt: new Date() });
      nuevos++;
    } else {
      await db
        .update(docentesExternosTable)
        .set(values)
        .where(sql`${docentesExternosTable.username} = ${values.username}`);
      actualizados++;
    }
  }

  return { total: data.length, nuevos, actualizados };
}

router.post("/", requireAuth, requireRole("administrador", "coordinador"), async (req: any, res) => {
  try {
    const cookie: string =
      (req.headers["x-intranet-cookie"] as string) ||
      req.body?.cookie ||
      process.env.INTRANET_COOKIE ||
      "";

    const termId: string =
      req.body?.termId ||
      process.env.INTRANET_TERM_ID ||
      "08de1730-801b-4d3d-81a8-e840d74c49fa";

    if (!cookie) {
      return res.status(400).json({
        error: "COOKIE_REQUERIDA",
        message: "Debes proporcionar la cookie de sesión de la intranet.",
      });
    }

    const result = await sincronizarDocentes(cookie, termId);
    res.json({ ok: true, ...result, message: "Sincronización completada" });
  } catch (err: any) {
    console.error("[sincronizar-docentes] error:", err);
    if (err.message === "AUTH_EXPIRED") {
      return res.status(401).json({ error: "AUTH_EXPIRED", message: "Cookie expirada o sin acceso a la intranet." });
    }
    if (err.message === "INVALID_RESPONSE") {
      return res.status(502).json({ error: "INVALID_RESPONSE", message: "La API externa devolvió un formato inesperado." });
    }
    res.status(500).json({ error: "SYNC_ERROR", message: err.message || "Error al sincronizar" });
  }
});

router.get("/", requireAuth, async (req: any, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    let rows;

    if (q) {
      rows = await db
        .select()
        .from(docentesExternosTable)
        .where(
          or(
            ilike(docentesExternosTable.name, `%${q}%`),
            ilike(docentesExternosTable.username, `%${q}%`),
          )
        )
        .orderBy(docentesExternosTable.name);
    } else {
      rows = await db
        .select()
        .from(docentesExternosTable)
        .orderBy(docentesExternosTable.name);
    }

    res.json(rows);
  } catch (err) {
    console.error("[sincronizar-docentes] GET error:", err);
    res.status(500).json({ error: "Error al obtener docentes" });
  }
});

export default router;
