import { Router } from "express";
import { db } from "@workspace/db";
import { justificacionesTable, activityLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const requireGestor = requireRole("administrador", "coordinador");

const router = Router();

const sanitize = (s: string) => s.replace(/^[=+\-@\t\r]+/, "").slice(0, 1000);

async function logActivity(
  req: any,
  type: string,
  detail: string
): Promise<void> {
  try {
    const user = req.currentUser;
    if (!user) return;
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    await db.insert(activityLogsTable).values({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      type,
      detail,
      ip,
    });
  } catch (e) {
    console.error("[justificaciones] log error:", e);
  }
}

router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(justificacionesTable)
      .orderBy(desc(justificacionesTable.createdAt));
    res.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        justificadoAt: r.justificadoAt ? r.justificadoAt.toISOString() : null,
      }))
    );
  } catch (e) {
    console.error("[justificaciones] list error:", e);
    res.status(500).json({ error: "Error al obtener justificaciones" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { apellidoNombre, curso, ciclo, docente, dia, descripcion } =
      req.body ?? {};
    if (
      typeof apellidoNombre !== "string" || !apellidoNombre.trim() ||
      typeof curso !== "string" || !curso.trim() ||
      typeof ciclo !== "string" || !ciclo.trim() ||
      typeof docente !== "string" || !docente.trim() ||
      typeof dia !== "string" || !dia.trim()
    ) {
      res.status(400).json({ error: "Datos incompletos" });
      return;
    }
    const user = (req as any).currentUser;
    const [row] = await db
      .insert(justificacionesTable)
      .values({
        apellidoNombre: sanitize(apellidoNombre.trim()),
        curso: sanitize(curso.trim()),
        ciclo: sanitize(ciclo.trim()),
        docente: sanitize(docente.trim()),
        dia: sanitize(dia.trim()),
        descripcion: descripcion ? sanitize(String(descripcion).trim()).slice(0, 2000) : null,
        createdByUserId: user?.id ?? null,
        createdByUsername: user?.username ?? null,
      })
      .returning();
    await logActivity(
      req,
      "justificacion_registro",
      `Registró justificación de ${row.apellidoNombre} (${row.curso} · C${row.ciclo} · ${row.dia})`
    );
    res.status(201).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      justificadoAt: row.justificadoAt ? row.justificadoAt.toISOString() : null,
    });
  } catch (e) {
    console.error("[justificaciones] create error:", e);
    res.status(500).json({ error: "Error al registrar" });
  }
});

router.patch("/:id", requireAuth, requireGestor, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { justificado } = req.body ?? {};
    const user = (req as any).currentUser;
    const [row] = await db
      .update(justificacionesTable)
      .set({
        justificado: !!justificado,
        justificadoAt: justificado ? new Date() : null,
        justificadoPor: justificado ? (user?.username ?? null) : null,
      })
      .where(eq(justificacionesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
    await logActivity(
      req,
      justificado ? "justificacion_check" : "justificacion_uncheck",
      `${justificado ? "Marcó como justificado" : "Desmarcó"} a ${row.apellidoNombre} (${row.curso})`
    );
    res.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      justificadoAt: row.justificadoAt ? row.justificadoAt.toISOString() : null,
    });
  } catch (e) {
    console.error("[justificaciones] patch error:", e);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

router.delete("/:id", requireAuth, requireGestor, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [row] = await db
      .select()
      .from(justificacionesTable)
      .where(eq(justificacionesTable.id, id));
    if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
    await db.delete(justificacionesTable).where(eq(justificacionesTable.id, id));
    await logActivity(
      req,
      "justificacion_eliminacion",
      `Eliminó justificación de ${row.apellidoNombre} (${row.curso})`
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[justificaciones] delete error:", e);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
