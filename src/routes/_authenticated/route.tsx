import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMySession } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const loadSession = useServerFn(getMySession);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });
  const role = sessionQuery.data?.role;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to={role === "admin" ? "/admin" : "/jornada"}
            className="font-display text-sm font-bold tracking-tight sm:text-base"
          >
            Panel del Operario
          </Link>

          <nav className="flex items-center gap-1">
            {role === "admin" && (
              <>
                <Link
                  to="/admin"
                  activeProps={{ className: "bg-accent" }}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Órdenes
                </Link>
                <Link
                  to="/admin/operarios"
                  activeProps={{ className: "bg-accent" }}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Operarios
                </Link>
                <Link
                  to="/admin/estadisticas"
                  activeProps={{ className: "bg-accent" }}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Estadísticas
                </Link>
              </>
            )}
            {role === "operario" && (
              <Link
                to="/jornada"
                activeProps={{ className: "bg-accent" }}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Mi jornada
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
