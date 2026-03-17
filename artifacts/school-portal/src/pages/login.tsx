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

      {/* Right Institutional Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(218,75%,24%) 0%, hsl(218,75%,32%) 50%, hsl(218,65%,20%) 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(-30%, 30%)" }} />
        <div className="absolute bottom-1/3 right-0 w-40 h-40 rounded-full opacity-5" style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(40%, 0)" }} />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3, duration: 0.7 }}
          className="relative z-10 flex flex-col items-center text-center px-16"
        >
          {/* Large Logo */}
          <div className="w-32 h-32 bg-white/10 rounded-3xl p-4 mb-8 shadow-2xl backdrop-blur-sm border border-white/20">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="IUAC" className="w-full h-full object-contain" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-3 leading-tight tracking-tight">
            Instituto Universitario<br/>Autónoma de Caripito
          </h2>
          <div className="w-16 h-1 bg-white/40 rounded-full my-5 mx-auto" />
          <p className="text-lg text-white/75 max-w-sm leading-relaxed">
            Sistema de gestión académica integral para nuestra comunidad universitaria.
          </p>

          {/* Decorative stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-sm">
            {[
              { label: "Docentes", value: "50+" },
              { label: "Secciones", value: "20+" },
              { label: "Cursos", value: "30+" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)" }}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/60 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
