import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text requerido" });
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "onyx", format: "mp3" },
      messages: [
        {
          role: "system",
          content:
            "Eres un locutor profesional de radio en Perú. " +
            "Tu único trabajo es leer el guión que te dan, tal cual, " +
            "con voz masculina, cálida y natural en español peruano. " +
            "NO respondas ni agregues nada. Solo lee el guión.",
        },
        {
          role: "user",
          content: `Guión a leer: "${text}"`,
        },
      ],
    });

    const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
    const audioBuffer = Buffer.from(audioData, "base64");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    console.error("[TTS]", err);
    res.status(500).json({ error: "Error generando audio" });
  }
});

export default router;
