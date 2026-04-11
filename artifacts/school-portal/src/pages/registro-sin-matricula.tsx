import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, RefreshCw, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const CARRERAS = [
  "ADMINISTRACIÓN DE EMPRESAS",
  "CONTABILIDAD",
  "DERECHO",
  "ENFERMERÍA",
  "FARMACIA Y BIOQUÍMICA",
  "INGENIERÍA AMBIENTAL",
  "INGENIERÍA CIVIL",
  "INGENIERÍA DE SISTEMAS",
  "INGENIERÍA INDUSTRIAL",
  "MEDICINA VETERINARIA",
  "OBSTETRICIA",
  "PSICOLOGÍA",
  "TURISMO Y HOTELERÍA",
  "OTRA",
];

export default function RegistroSinMatricula() {
  const { toast } = useToast();

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [carrera, setCarrera] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast({ title: "El nombre es requerido", variant: "destructive" }); return; }
    if (!dni.trim() || dni.trim().length < 7) { toast({ title: "Ingresa un DNI válido", variant: "destructive" }); return; }
    if (!carrera) { toast({ title: "Selecciona tu carrera", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/sin-matricula`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apellidosNombres: nombre.trim().toUpperCase(),
          dni: dni.trim(),
          carrera: carrera.toUpperCase(),
          registradoPor: "autoregistro-qr",
          registradoVia: "qr",
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      setSuccess(true);
    } catch (e) {
      toast({ title: "Error al registrar", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#001F5F] via-[#002580] to-[#001040] px-4 py-8">

      {/* Logo / encabezado */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: GOLD }}>
          <UserX className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-white font-black text-xl text-center leading-tight">
          UNIVERSIDAD AUTÓNOMA DE ICA
        </h1>
        <p className="text-white/60 text-sm font-medium mt-1">Portal Académico 2026-I</p>
      </div>

      <Card className="w-full max-w-md rounded-2xl shadow-2xl">
        <CardContent className="p-7">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <h2 className="text-lg font-black" style={{ color: NAVY }}>¡Registro Exitoso!</h2>
              <p className="text-sm text-muted-foreground">
                Tu información ha sido registrada correctamente. El personal administrativo te contactará para completar tu matrícula.
              </p>
              <Button
                onClick={() => { setSuccess(false); setNombre(""); setDni(""); setCarrera(""); }}
                variant="outline" size="sm"
              >
                Registrar otro
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-base font-black" style={{ color: NAVY }}>Registro — Sin Matrícula</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Completa tus datos para que el área administrativa pueda atenderte.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Apellidos y Nombres <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="APELLIDOS NOMBRES"
                  value={nombre}
                  onChange={e => setNombre(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>DNI <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="12345678"
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  maxLength={8}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Carrera <span className="text-red-500">*</span></Label>
                <Select value={carrera} onValueChange={setCarrera}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu carrera..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRERAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-bold text-sm"
                style={{ background: NAVY, color: "#fff" }}
                disabled={saving}
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Registrando…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Registrarme</>
                )}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                Universidad Autónoma de Ica · Matrícula 2026-I
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
