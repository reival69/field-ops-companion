import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAdmin, deleteAdmin, listAdmins } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/administradores")({
  head: () => ({
    meta: [
      { title: "Administradores — Panel de administración" },
      {
        name: "description",
        content: "Alta y baja de cuentas de administrador de la empresa.",
      },
      { property: "og:title", content: "Administradores — Panel de administración" },
      { property: "og:description", content: "Gestión de cuentas de administrador." },
    ],
  }),
  component: AdminAdministradoresPage,
});

function AdminAdministradoresPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const remove = useServerFn(deleteAdmin);

  const listQuery = useQuery({ queryKey: ["admins"], queryFn: () => fetchList() });
  const admins = listQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Administrador eliminado");
      void queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Administradores</h1>
          <p className="text-sm text-muted-foreground">{admins.length} con acceso total</p>
        </div>
        <CreateAdminDialog
          onCreate={async (payload) => {
            await create({ data: payload });
            toast.success("Administrador dado de alta");
            void queryClient.invalidateQueries({ queryKey: ["admins"] });
          }}
        />
      </div>

      {listQuery.isPending ? (
        <p className="mt-8 text-center text-muted-foreground">Cargando administradores…</p>
      ) : admins.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">No hay administradores.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {admins.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold">
                  {a.full_name || "Sin nombre"}{" "}
                  {a.is_self && <span className="text-xs font-normal text-muted-foreground">(Tú)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{a.email}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={a.is_self || admins.length <= 1 || deleteMutation.isPending}
                    title={
                      a.is_self
                        ? "No puedes eliminar tu propia cuenta"
                        : admins.length <= 1
                          ? "Debe quedar al menos un administrador"
                          : undefined
                    }
                  >
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar a {a.full_name || a.email}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Perderá acceso al panel de administración de
                      inmediato.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CreateAdminDialog({
  onCreate,
}: {
  onCreate: (payload: { email: string; password: string; fullName: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onCreate({ email, password, fullName });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear el administrador");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Nuevo administrador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de alta administrador</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="admin-fullName">Nombre y apellidos</Label>
            <Input
              id="admin-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña (mín. 8 caracteres)</Label>
            <Input
              id="admin-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear administrador"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
