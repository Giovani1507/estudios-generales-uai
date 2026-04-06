import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: { ciphers: "SSLv3" },
});

router.post("/send", async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body as {
      to: string;
      subject: string;
      body: string;
      attachments?: { filename: string; content: string; encoding: string }[];
    };

    if (!to || !subject || !body) {
      res.status(400).json({ error: "Faltan campos: to, subject, body" });
      return;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Estudios Generales UAI" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html: body.replace(/\n/g, "<br>"),
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })),
    };

    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: "Correo enviado correctamente" });
  } catch (err: any) {
    console.error("Error enviando correo:", err);
    res.status(500).json({ error: err.message || "Error al enviar correo" });
  }
});

export default router;
