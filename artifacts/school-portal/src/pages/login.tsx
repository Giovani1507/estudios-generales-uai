import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Building2, Lock, User, Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Usuario requerido"),
  password: z.string().min(3, "Contraseña requerida"),
});

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (error: any) => {
        setErrorMsg(error.response?.data?.error || "Credenciales incorrectas");
      }
    }
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg("");
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Form Side */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative z-10 shadow-2xl">
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <span className="font-display font-bold text-lg text-primary tracking-tight">IUAC</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto"
        >
          <div className="mb-10 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg border border-border p-3">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-display font-bold text-primary mb-3">Portal Académico</h1>
            <p className="text-muted-foreground text-sm">Ingrese sus credenciales para acceder al sistema institucional.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-center text-center">
              {errorMsg}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-semibold">Usuario</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <User className="w-5 h-5" />
                        </div>
                        <Input 
                          placeholder="Ingrese su usuario" 
                          className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-white focus:ring-primary/20 transition-all" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-semibold">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Lock className="w-5 h-5" />
                        </div>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-white focus:ring-primary/20 transition-all" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                disabled={loginMutation.isPending}
                className="w-full h-12 mt-4 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando...</>
                ) : "Iniciar Sesión"}
              </Button>
            </form>
          </Form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Instituto Universitario Autónoma de Caripito.<br/>Todos los derechos reservados.
          </p>
        </motion.div>
      </div>

      {/* Right Image Side */}
      <div className="hidden lg:block lg:w-1/2 relative bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/60 to-accent/80 z-10 mix-blend-multiply" />
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Campus architecture" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white p-12 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }}>
            <h2 className="text-4xl font-display font-bold mb-6 leading-tight">Excelencia Académica<br/>Para El Futuro</h2>
            <p className="text-lg text-white/80 max-w-lg mx-auto font-light">
              Plataforma de gestión integral diseñada para potenciar la experiencia educativa de nuestra comunidad.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
