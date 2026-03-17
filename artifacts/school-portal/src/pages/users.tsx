import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit, Trash2, Shield, Mail, Key } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const userSchema = z.object({
  username: z.string().min(3, "Usuario requerido"),
  fullName: z.string().min(3, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(4, "Contraseña mínima 4 caracteres").optional().or(z.literal("")),
  role: z.enum(["administrador", "coordinador", "administrativo"]),
});

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", fullName: "", email: "", password: "", role: "administrativo" },
  });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        setIsDialogOpen(false);
        toast({ title: "Éxito", description: "Usuario creado." });
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo crear el usuario." })
    }
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        setIsDialogOpen(false);
        setEditingUser(null);
        toast({ title: "Éxito", description: "Usuario actualizado." });
      }
    }
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        toast({ title: "Eliminado", description: "Usuario eliminado." });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    if (editingUser) {
      // Remove password if empty on update
      const payload = { ...values };
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editingUser.id, data: payload as any });
    } else {
      if (!values.password) {
        form.setError("password", { message: "Contraseña requerida para nuevo usuario" });
        return;
      }
      createMutation.mutate({ data: values as any });
    }
  };

  const handleEdit = (u: User) => {
    setEditingUser(u);
    form.reset({
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      password: "",
      role: u.role,
    });
    setIsDialogOpen(true);
  };

  if (currentUser?.role !== "administrador") {
    return <div className="text-center py-20 text-destructive font-bold text-2xl">Acceso Denegado</div>;
  }

  const roleColors: Record<string, string> = {
    administrador: "bg-destructive/10 text-destructive border-destructive/20",
    coordinador: "bg-primary/10 text-primary border-primary/20",
    administrativo: "bg-accent/10 text-accent border-accent/20",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administre los accesos y roles del sistema.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            form.reset({ username: "", fullName: "", email: "", password: "", role: "administrativo" });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg">
              <UserPlus className="w-5 h-5 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display text-primary">
                {editingUser ? "Editar Usuario" : "Crear Usuario"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Ej. Juan Pérez" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl><Input placeholder="jperez" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccione rol" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="administrador">Administrador</SelectItem>
                          <SelectItem value="coordinador">Coordinador</SelectItem>
                          <SelectItem value="administrativo">Administrativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="correo@institucion.edu" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña {editingUser && <span className="text-xs text-muted-foreground font-normal">(Dejar en blanco para no cambiar)</span>}</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl">
                    {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-lg shadow-primary/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-bold text-primary pl-6">Usuario</TableHead>
                    <TableHead className="font-bold text-primary">Contacto</TableHead>
                    <TableHead className="font-bold text-primary">Rol</TableHead>
                    <TableHead className="font-bold text-primary text-right pr-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => (
                    <TableRow key={u.id} className="hover:bg-primary/5">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {u.fullName.substring(0,2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-foreground">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" /> {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${roleColors[u.role]}`}>
                          <Shield className="w-3 h-3 mr-1" /> {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} className="hover:bg-primary/10 hover:text-primary rounded-full">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={currentUser?.id === u.id}
                            onClick={() => {
                              if(confirm(`¿Eliminar al usuario ${u.username}?`)) {
                                deleteMutation.mutate({ id: u.id });
                              }
                            }} 
                            className="hover:bg-destructive/10 hover:text-destructive rounded-full disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
