import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListCourses, useCreateCourse, useUpdateCourse, useDeleteCourse, Course } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Edit, Trash2, CheckCircle2, XCircle } from "lucide-react";

const courseSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  code: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, "Debe ser mayor a 0"),
});

export default function Courses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: courses, isLoading } = useListCourses();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const form = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: "", code: "", description: "", credits: 3 },
  });

  const createMutation = useCreateCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
        setIsDialogOpen(false);
        toast({ title: "Éxito", description: "Curso creado correctamente." });
        form.reset();
      }
    }
  });

  const updateMutation = useUpdateCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
        setIsDialogOpen(false);
        setEditingCourse(null);
        toast({ title: "Éxito", description: "Curso actualizado correctamente." });
      }
    }
  });

  const deleteMutation = useDeleteCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
        toast({ title: "Eliminado", description: "Curso eliminado correctamente." });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof courseSchema>) => {
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, data: values });
    } else {
      createMutation.mutate({ data: values });
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    form.reset({
      name: course.name,
      code: course.code,
      description: course.description || "",
      credits: course.credits,
    });
    setIsDialogOpen(true);
  };

  const isAdmin = user?.role === "administrador";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">Cursos y Asignaturas</h1>
          <p className="text-muted-foreground">Catálogo de materias impartidas en la institución.</p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingCourse(null);
              form.reset({ name: "", code: "", description: "", credits: 3 });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg hover:-translate-y-0.5 transition-all">
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display text-primary">
                  {editingCourse ? "Editar Curso" : "Crear Nuevo Curso"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="code" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. MAT101" className="rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="credits" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Créditos</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} className="rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Curso</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Matemáticas I" className="rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Breve descripción del curso..." className="rounded-xl resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl">
                      {editingCourse ? "Guardar Cambios" : "Crear Curso"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-none shadow-lg shadow-primary/5">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-bold text-primary pl-6">Código</TableHead>
                    <TableHead className="font-bold text-primary">Asignatura</TableHead>
                    <TableHead className="font-bold text-primary text-center">Créditos</TableHead>
                    <TableHead className="font-bold text-primary text-center">Estado</TableHead>
                    {isAdmin && <TableHead className="font-bold text-primary text-right pr-6">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses?.map((course) => (
                    <TableRow key={course.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="pl-6 font-mono font-medium text-muted-foreground">
                        {course.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{course.name}</p>
                            {course.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-lg">
                        {course.credits}
                      </TableCell>
                      <TableCell className="text-center">
                        {course.isActive ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Activo</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Inactivo</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(course)} className="hover:bg-primary/10 hover:text-primary rounded-full">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                if(confirm("¿Seguro que desea eliminar este curso?")) {
                                  deleteMutation.mutate({ id: course.id });
                                }
                              }} 
                              className="hover:bg-destructive/10 hover:text-destructive rounded-full"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {(!courses || courses.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center text-muted-foreground">
                        No hay cursos registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
