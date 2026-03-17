import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, Announcement } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellPlus, Calendar, Trash2, User } from "lucide-react";
import { motion } from "framer-motion";

const announcementSchema = z.object({
  title: z.string().min(5, "El título es muy corto"),
  content: z.string().min(10, "El contenido debe tener al menos 10 caracteres"),
  priority: z.enum(["normal", "importante", "urgente"]),
});

export default function Announcements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: announcements, isLoading } = useListAnnouncements();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", content: "", priority: "normal" },
  });

  const createMutation = useCreateAnnouncement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
        setIsDialogOpen(false);
        toast({ title: "Publicado", description: "El aviso se ha publicado correctamente." });
        form.reset();
      }
    }
  });

  const deleteMutation = useDeleteAnnouncement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
        toast({ title: "Eliminado", description: "El aviso ha sido eliminado." });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof announcementSchema>) => {
    createMutation.mutate({ data: values as any });
  };

  const canCreate = user?.role === "administrador" || user?.role === "coordinador";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Avisos y Comunicados</h1>
          <p className="text-muted-foreground">Tablón de anuncios oficiales de la institución.</p>
        </div>
        
        {canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) form.reset();
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg">
                <BellPlus className="w-5 h-5 mr-2" />
                Publicar Aviso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display text-primary">Nuevo Comunicado</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del Aviso</FormLabel>
                      <FormControl><Input placeholder="Ej. Suspensión de actividades" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccione prioridad" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="importante">Importante</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="content" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenido del Mensaje</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Escriba aquí el cuerpo del comunicado..." className="rounded-xl min-h-[150px] resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createMutation.isPending} className="rounded-xl">
                      Publicar
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {announcements?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((announcement, idx) => (
            <motion.div key={announcement.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="border-border/50 shadow-md hover:shadow-lg transition-all relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  announcement.priority === 'urgente' ? 'bg-destructive' : 
                  announcement.priority === 'importante' ? 'bg-accent' : 'bg-primary'
                }`} />
                <CardContent className="p-6 sm:p-8 pl-8 sm:pl-10">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={announcement.priority === 'urgente' ? 'destructive' : announcement.priority === 'importante' ? 'default' : 'secondary'} className="capitalize">
                          {announcement.priority}
                        </Badge>
                        <span className="flex items-center text-xs text-muted-foreground font-medium">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(announcement.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-foreground">{announcement.title}</h2>
                    </div>
                    {canCreate && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if(confirm("¿Eliminar este aviso?")) deleteMutation.mutate({ id: announcement.id });
                        }}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap mb-6">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium bg-muted/30 p-2 px-4 rounded-lg inline-flex">
                    <User className="w-4 h-4 text-primary" />
                    Publicado por: <span className="font-bold">{announcement.authorName}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {(!announcements || announcements.length === 0) && (
            <div className="py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-2xl bg-white/50">
              <Bell className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No hay comunicados</h3>
              <p className="text-muted-foreground">Actualmente no existen avisos publicados en el sistema.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
