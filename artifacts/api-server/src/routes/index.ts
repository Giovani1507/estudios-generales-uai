import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import teachersRouter from "./teachers.js";
import sectionsRouter from "./sections.js";
import coursesRouter from "./courses.js";
import schedulesRouter from "./schedules.js";
import announcementsRouter from "./announcements.js";
import reportsRouter from "./reports.js";
import emailRouter from "./email.js";
import ttsRouter from "./tts.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tts", ttsRouter);
router.use("/users", usersRouter);
router.use("/teachers", teachersRouter);
router.use("/sections", sectionsRouter);
router.use("/courses", coursesRouter);
router.use("/schedules", schedulesRouter);
router.use("/announcements", announcementsRouter);
router.use("/reports", reportsRouter);
router.use("/email", emailRouter);

export default router;
