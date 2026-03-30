import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Paperclip, X, Send, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";

interface Fila {
  docente: string;
  [key: string]: unknown;
}

interface Attachment {
  name: string;
  base64: string;
  size: number;
  type: string;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EnviarCorreo() {
  const [docentes, setDocentes] = useState<string[]>([]);
  const [selectedDocente, setSelectedDocente] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fica-2026-1.json`)
      .then((r) => r.json())
      .then((data: Fila[]) => {
        const set = new Set<string>();
        data.forEach((f) => {
          if (f.docente && typeof f.docente === "string") set.add(f.docente.trim());
        });
        setDocentes(Array.from(set).sort());
      })
      .catch(() => {});
  }, []);

  const handleDocenteChange = (val: string) => {
    setSelectedDocente(val);
    if (!subject) {
      setSubject(`Horario de clases 2026-I — ${val}`);
    }
    if (!body) {
      setBody(
        `Estimado/a docente ${val},\n\nAdjunto encontrará su horario de clases correspondiente al semestre 2026-I.\n\nCualquier consulta o corrección, comunicarse con la coordinación de Estudios Generales.\n\nSaludos cordiales,\nCoordinación de Estudios Generales\nUniversidad Autónoma de Ica`
      );
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          { name: file.name, base64, size: file.size, type: file.type },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleSend = async () => {
    if (!to.trim()) { setStatusMsg("Ingrese el correo del destinatario."); setStatus("error"); return; }
    if (!subject.trim()) { setStatusMsg("Ingrese el asunto del correo."); setStatus("error"); return; }
    if (!body.trim()) { setStatusMsg("Escriba el cuerpo del mensaje."); setStatus("error"); return; }

    setStatus("sending");
    setStatusMsg("");
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          attachments: attachments.map((a) => ({
            filename: a.name,
            content: a.base64,
            encoding: "base64",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setStatus("success");
      setStatusMsg("¡Correo enviado correctamente!");
    } catch (err: any) {
      setStatus("error");
      setStatusMsg(err.message || "No se pudo enviar el correo. Revise la configuración SMTP.");
    }
  };

  const resetForm = () => {
    setSelectedDocente("");
    setTo("");
    setSubject("");
    setBody("");
    setAttachments([]);
    setStatus("idle");
    setStatusMsg("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Enviar Correo</h1>
          <p className="text-sm text-muted-foreground">Envío de comunicados a docentes vía Outlook</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Seleccionar Docente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDocente} onValueChange={handleDocenteChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione un docente (opcional)..." />
            </SelectTrigger>
            <SelectContent>
              {docentes.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Seleccionar un docente completa automáticamente el asunto y cuerpo del mensaje.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Composición del Correo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">Destinatario *</Label>
            <Input
              id="to"
              type="email"
              placeholder="correo@ejemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Asunto *</Label>
            <Input
              id="subject"
              placeholder="Asunto del correo..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensaje *</Label>
            <Textarea
              id="body"
              placeholder="Escriba el cuerpo del mensaje..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-y font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Archivos adjuntos</Label>
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Paperclip className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Haga clic o arrastre archivos aquí para adjuntarlos
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                PDF, Word, Excel, imágenes, etc.
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2 mt-2">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{a.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {humanSize(a.size)}
                      </Badge>
                    </div>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {status !== "idle" && (
            <div
              className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
                status === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : status === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              {status === "sending" && <Loader2 className="w-4 h-4 mt-0.5 animate-spin shrink-0" />}
              {status === "success" && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {status === "error" && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSend}
              disabled={status === "sending"}
              className="flex-1"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Correo
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={status === "sending"}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Los correos se envían desde{" "}
        <span className="font-medium">estudiosgenerales@autonomadeica.edu.pe</span>{" "}
        vía Outlook (smtp.office365.com).
      </p>
    </div>
  );
}
