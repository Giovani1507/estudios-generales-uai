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

    // Llamada directa al modelo con estilo de voz natural humano
    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "shimmer", format: "mp3" },
      messages: [
        {
          role: "system",
          content:
            "Eres una recepcionista amigable de la Universidad Autónoma de Ica. " +
            "Habla en español de América Latina con un tono cálido, natural y alegre, " +
            "como una persona real — no como un robot ni una máquina. " +
            "Usa entonación natural, con pausas y énfasis donde corresponda.",
        },
        {
          role: "user",
          content: text,
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
