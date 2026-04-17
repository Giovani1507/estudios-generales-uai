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
import { Lock, User, Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        setErrorMsg(error?.data?.error || "Usuario o contraseña incorrectos");
      },
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg("");
    loginMutation.mutate({ data: values });
  };

  return (
    <div
      className="min-h-screen w-full flex relative overflow-hidden"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}campus-bg-new.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#001340",
      }}
    >
      {/* Overlay uniforme para legibilidad */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,10,50,0.88) 0%, rgba(0,15,55,0.62) 40%, rgba(0,15,55,0.62) 70%, rgba(0,10,50,0.92) 100%)" }}
      />

      {/* Tarjeta centrada */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full min-h-screen px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          {/* Header card con logo y título */}
          <div className="mb-6 rounded-2xl bg-white/95 backdrop-blur-md border border-white/40 shadow-2xl px-6 pt-6 pb-5">
            <div className="flex justify-center mb-4">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Universidad Autónoma de Ica"
                className="object-contain"
                style={{ maxWidth: "260px", maxHeight: "80px" }}
              />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-extrabold mb-1 tracking-tight" style={{ color: "#0a1f5c" }}>
                Portal Académico
              </h1>
              <p className="text-sm font-medium" style={{ color: "#1e3a8a" }}>Universidad Autónoma de Ica · 2026-1</p>
              <p className="text-xs mt-0.5 text-slate-500">Estudios Generales</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8">
            {/* Error */}
            {errorMsg && (
              <div className="w-full mb-5 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-sm font-medium text-center">
                {errorMsg}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-white/90 text-sm">Usuario</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                          <Input
                            placeholder="Ingrese su usuario"
                            className="pl-9 h-11 rounded-lg bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/50"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-300" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-white/90 text-sm">Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-9 pr-10 h-11 rounded-lg bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/50"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white/90"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-300" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full h-12 mt-2 text-base font-bold rounded-xl text-white shadow-lg"
                  style={{ background: "linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)" }}
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <p className="mt-5 text-center text-xs text-white/40">
            Sistema de acceso restringido · Universidad Autónoma de Ica © {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
