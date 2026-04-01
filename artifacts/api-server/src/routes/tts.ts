import { Router } from "express";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { text, voice = "nova" } = req.body as { text: string; voice?: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text requerido" });
      return;
    }
    const audioBuffer = await textToSpeech(
      text,
      voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      "mp3"
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    console.error("[TTS]", err);
    res.status(500).json({ error: "Error generando audio" });
  }
});

export default router;
