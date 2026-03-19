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
import { Lock, User, Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
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
        setErrorMsg(error?.response?.data?.error || "Usuario o contraseña incorrectos");
      },
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg("");
    loginMutation.mutate({ data: values });
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}campus-bg.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay oscuro para legibilidad */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="bg-white rounded-2xl shadow-xl shadow-black/10 p-10 flex flex-col items-center">
          {/* Logo */}
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Universidad Autónoma de Ica"
            className="object-contain mb-5"
            style={{ maxWidth: "280px", maxHeight: "84px" }}
          />

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground text-center mb-1">
            Portal Académico
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-1">
            Universidad Autónoma de Ica · 2026-1
          </p>
          <p className="text-xs text-muted-foreground/70 text-center mb-7">
            Estudios Generales
          </p>

          {/* Error */}
          {errorMsg && (
            <div className="w-full mb-5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Usuario</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Ingrese su usuario"
                          className="pl-9 h-11 rounded-lg bg-muted/40 border-border"
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
                    <FormLabel className="font-semibold text-foreground">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9 h-11 rounded-lg bg-muted/40 border-border"
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
                className="w-full h-12 mt-2 text-base font-bold rounded-xl"
                style={{ background: "hsl(218,75%,32%)" }}
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

        <p className="mt-5 text-center text-xs text-white/70">
          Sistema de acceso restringido · Universidad Autónoma de Ica © {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
