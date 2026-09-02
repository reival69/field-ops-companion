import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminExists, bootstrapAdmin } from "@/lib/admin.functions";
import { getMySession } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder — Panel del Operario" },
      {
        name: "description",
        content:
          "Inicia sesión para ver tus órdenes de trabajo asignadas o gestionar el panel de administración.",
      },
      { property: "og:title", content: "Acceder — Panel del Operario" },
      {
        property: "og:description",
        content: "Acceso para operarios de mantenimiento y administradores de la empresa.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(adminExists);
  const createFirstAdmin = useServerFn(bootstrapAdmin);
  const loadSession = useServerFn(getMySession);

  const adminQuery = useQuery({ queryKey: ["admin-exists"], queryFn: () => checkAdmin() });
  const [mode, setMode] = useState<"login" | "bootstrap">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const goToHome = async () => {
    const session = await loadSession();
    await navigate({ to: session.role === "admin" ? "/admin" : "/jornada" });
  };

  const login = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    onSuccess: goToHome,
    onError: (error: Error) =>
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : error.message,
      ),
  });

  const bootstrap = useMutation({
    mutationFn: async () => {
      await createFirstAdmin({ data: { email, password, fullName } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Cuenta de administrador creada");
      await goToHome();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noAdminYet = adminQuery.data?.exists === false;
  const isBootstrap = mode === "bootstrap" && noAdminYet;
  const pending = login.isPending || bootstrap.isPending;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Link to="/" className="font-display text-lg font-bold">
          Panel del Operario
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
          <h1 className="text-2xl font-bold">
            {isBootstrap ? "Crear cuenta de administrador" : "Iniciar sesión"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isBootstrap
              ? "Esta será la cuenta que gestione operarios y órdenes de trabajo."
              : "Accede con el email y la contraseña que te ha dado tu empresa."}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (isBootstrap) bootstrap.mutate();
              else login.mutate();
            }}
          >
            {isBootstrap && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre y apellidos</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={isBootstrap ? "new-password" : "current-password"}
              />
            </div>

            <Button type="submit" size="lg" className="w-full text-base" disabled={pending}>
              {pending ? "Un momento…" : isBootstrap ? "Crear cuenta y entrar" : "Entrar"}
            </Button>
          </form>

          {noAdminYet && (
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "bootstrap" : "login")}
              className="mt-5 w-full text-sm text-primary underline-offset-4 hover:underline"
            >
              {mode === "login"
                ? "Todavía no hay administrador: crear la primera cuenta"
                : "Ya tengo cuenta, quiero iniciar sesión"}
            </button>
          )}

          {!noAdminYet && (
            <p className="mt-5 text-xs text-muted-foreground">
              Las cuentas de operario las crea el administrador desde el panel web.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
