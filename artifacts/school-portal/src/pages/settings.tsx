import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Save, User, Bell, Shield, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "perfil" | "institucion" | "notificaciones" | "seguridad";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil", label: "Mi Perfil", icon: User },
  { id: "institucion", label: "Institución", icon: Building2 },
  { id: "notificaciones", label: "Notificaciones", icon: Bell },
  { id: "seguridad", label: "Seguridad", icon: Shield },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Guardado", description: "Configuración actualizada correctamente." });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">Configuración</h1>
        <p className="text-muted-foreground">Administre sus preferencias y datos de la cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="md:col-span-1 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                  ${isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="md:col-span-3">

          {/* ── Mi Perfil ── */}
          {activeTab === "perfil" && (
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Sus datos como usuario del sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre Completo</Label>
                      <Input defaultValue={user?.fullName} className="bg-muted/50 rounded-xl" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Usuario</Label>
                      <Input defaultValue={user?.username} className="bg-muted/50 rounded-xl" disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo Electrónico</Label>
                    <Input defaultValue={user?.email ?? ""} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol en el Sistema</Label>
                    <Input defaultValue={user?.role} className="bg-muted/50 rounded-xl capitalize" disabled />
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button type="submit" className="rounded-xl bg-primary text-white gap-2">
                      <Save className="w-4 h-4" /> Guardar Cambios
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Institución ── */}
          {activeTab === "institucion" && (
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Datos de la Institución</CardTitle>
                <CardDescription>Información general de la Universidad Autónoma de Ica.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre de la Institución</Label>
                  <Input defaultValue="Universidad Autónoma de Ica" className="bg-muted/50 rounded-xl" disabled />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Siglas</Label>
                    <Input defaultValue="UAI" className="bg-muted/50 rounded-xl" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Período Académico</Label>
                    <Input defaultValue="2026-1" className="bg-muted/50 rounded-xl" disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Programa</Label>
                  <Input defaultValue="Estudios Generales" className="bg-muted/50 rounded-xl" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Correo Institucional</Label>
                  <Input defaultValue="informes@autonomadeica.edu.pe" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Sitio Web</Label>
                  <Input defaultValue="https://www.autonomadeica.edu.pe" className="rounded-xl" />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="button" className="rounded-xl bg-primary text-white gap-2"
                    onClick={() => toast({ title: "Guardado", description: "Datos institucionales actualizados." })}>
                    <Save className="w-4 h-4" /> Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Notificaciones ── */}
          {activeTab === "notificaciones" && (
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Preferencias de Notificación</CardTitle>
                <CardDescription>Controle qué avisos desea recibir en el sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { label: "Nuevos Avisos y Comunicados", desc: "Recibir alertas cuando se publiquen comunicados oficiales.", defaultOn: true },
                  { label: "Cambios de Horario", desc: "Notificaciones cuando se modifique un horario de clase.", defaultOn: true },
                  { label: "Recordatorios de Matrícula", desc: "Alertas sobre fechas importantes del proceso de matrícula.", defaultOn: true },
                  { label: "Reportes Generados", desc: "Avisar cuando un reporte esté listo para descargar.", defaultOn: false },
                  { label: "Actualizaciones del Sistema", desc: "Información sobre nuevas funciones o mantenimientos.", defaultOn: false },
                ].map((item) => (
                  <NotifToggle key={item.label} {...item} />
                ))}
                <div className="pt-4 flex justify-end">
                  <Button type="button" className="rounded-xl bg-primary text-white gap-2"
                    onClick={() => toast({ title: "Guardado", description: "Preferencias de notificación actualizadas." })}>
                    <Save className="w-4 h-4" /> Guardar Preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Seguridad ── */}
          {activeTab === "seguridad" && (
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Seguridad de la Cuenta</CardTitle>
                <CardDescription>Cambie su contraseña para mantener su cuenta segura.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const nueva = (form.elements.namedItem("nueva") as HTMLInputElement).value;
                    const confirmar = (form.elements.namedItem("confirmar") as HTMLInputElement).value;
                    if (nueva !== confirmar) {
                      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
                      return;
                    }
                    if (nueva.length < 6) {
                      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
                      return;
                    }
                    toast({ title: "Contraseña actualizada", description: "Su contraseña fue cambiada correctamente." });
                    form.reset();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="actual">Contraseña Actual</Label>
                    <Input id="actual" name="actual" type="password" placeholder="••••••••" className="rounded-xl" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nueva">Nueva Contraseña</Label>
                    <Input id="nueva" name="nueva" type="password" placeholder="••••••••" className="rounded-xl" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmar">Confirmar Nueva Contraseña</Label>
                    <Input id="confirmar" name="confirmar" type="password" placeholder="••••••••" className="rounded-xl" required />
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground mb-2">Requisitos de contraseña:</p>
                    <p>• Mínimo 6 caracteres</p>
                    <p>• Se recomienda combinar letras, números y símbolos</p>
                    <p>• No use su nombre de usuario como contraseña</p>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button type="submit" className="rounded-xl bg-primary text-white gap-2">
                      <Shield className="w-4 h-4" /> Cambiar Contraseña
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

function NotifToggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
