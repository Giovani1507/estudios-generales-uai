import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.currentUser?.role !== "administrador") {
    res.status(403).json({ error: "Acceso restringido al administrador" });
    return;
  }
  next();
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(500);
    res.json(logs);
  } catch (err) {
    console.error("Activity logs error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.post("/log", requireAuth, async (req, res) => {
  try {
    const user = (req as any).currentUser;
    const { type, detail } = req.body;
    if (!type) { res.status(400).json({ error: "type requerido" }); return; }
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    await db.insert(activityLogsTable).values({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      type,
      detail: detail ?? null,
      ip,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Log activity error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
