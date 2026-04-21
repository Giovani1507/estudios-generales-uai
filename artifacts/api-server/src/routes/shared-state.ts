import { Router } from "express";
import { db } from "@workspace/db";
import { sharedStateTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/:key", async (req, res) => {
  try {
    const key = String(req.params.key || "");
    if (!key) { res.status(400).json({ error: "key requerida" }); return; }
    const [row] = await db.select().from(sharedStateTable).where(eq(sharedStateTable.key, key));
    if (!row) {
      res.json({ key, value: null, updatedAt: null });
      return;
    }
    res.json({
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Error al obtener estado" });
  }
});

router.put("/:key", async (req, res) => {
  try {
    const key = String(req.params.key || "");
    if (!key) { res.status(400).json({ error: "key requerida" }); return; }
    const value = req.body?.value ?? null;
    const currentUser = (req as any).currentUser;
    const userId = currentUser?.id ?? null;
    const [row] = await db
      .insert(sharedStateTable)
      .values({ key, value, updatedBy: userId })
      .onConflictDoUpdate({
        target: sharedStateTable.key,
        set: { value, updatedBy: userId, updatedAt: sql`now()` },
      })
      .returning();
    res.json({
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Error al guardar estado" });
  }
});

export default router;
