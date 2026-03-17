import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Save, User, Bell, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Guardado", description: "Configuración actualizada correctamente." });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Configuración</h1>
        <p className="text-muted-foreground">Administre sus preferencias y datos de la cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-2">
          <Button variant="secondary" className="w-full justify-start font-bold bg-primary/10 text-primary">
            <User className="w-4 h-4 mr-2" /> Mi Perfil
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Building2 className="w-4 h-4 mr-2" /> Institución
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Bell className="w-4 h-4 mr-2" /> Notificaciones
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Shield className="w-4 h-4 mr-2" /> Seguridad
          </Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="shadow-lg shadow-black/5 border-border/50">
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
                  <Input defaultValue={user?.email} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Rol en el Sistema</Label>
                  <Input defaultValue={user?.role} className="bg-muted/50 rounded-xl capitalize" disabled />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" className="rounded-xl bg-primary shadow-lg hover:-translate-y-0.5 transition-all">
                    <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
