import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/restablecer-contrasena")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — Panel del Operario" },
      {
        name: "description",
        content: "Elige una nueva contraseña para tu cuenta.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
      if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      await supabase.auth.signOut();
      await navigate({ to: "/auth", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Link to="/" className="font-display text-lg font-bold">
          Panel del Operario
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
          <h1 className="text-2xl font-bold">Restablecer contraseña</h1>

          {!ready ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Este enlace no es válido o ha caducado. Solicita uno nuevo desde{" "}
              <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
                la pantalla de acceso
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Elige una nueva contraseña para tu cuenta.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  updatePassword.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base"
                  disabled={updatePassword.isPending}
                >
                  {updatePassword.isPending ? "Guardando…" : "Guardar contraseña"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
