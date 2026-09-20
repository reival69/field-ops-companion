import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createOperario, deleteOperario, listOperarios, setOperarioActive } from "@/lib/admin.functions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/admin/operarios")({
  head: () => ({
    meta: [
      { title: "Operarios — Panel de administración" },
      {
        name: "description",
        content: "Alta, activación y carga de trabajo de los operarios de la empresa.",
      },
      { property: "og:title", content: "Operarios — Panel de administración" },
      { property: "og:description", content: "Gestión de operarios de mantenimiento." },
    ],
  }),
  component: AdminOperariosPage,
});

function AdminOperariosPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listOperarios);
  const setActive = useServerFn(setOperarioActive);
  const create = useServerFn(createOperario);
  const remove = useServerFn(deleteOperario);

  const listQuery = useQuery({ queryKey: ["operarios"], queryFn: () => fetchList() });
  const operarios = listQuery.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setActive({ data: { id, active } }),
    onSuccess: () => {
      toast.success("Operario actualizado");
      void queryClient.invalidateQueries({ queryKey: ["operarios"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Operario eliminado");
      void queryClient.invalidateQueries({ queryKey: ["operarios"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Operarios</h1>
          <p className="text-sm text-muted-foreground">{operarios.length} en la red</p>
        </div>
        <CreateOperarioDialog
          onCreate={async (payload) => {
            await create({ data: payload });
            toast.success("Operario dado de alta");
            void queryClient.invalidateQueries({ queryKey: ["operarios"] });
          }}
        />
      </div>

      {listQuery.isPending ? (
        <p className="mt-8 text-center text-muted-foreground">Cargando operarios…</p>
      ) : operarios.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">
          Todavía no hay operarios. Da de alta al primero.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {operarios.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{o.full_name}</p>
                <p className="text-sm text-muted-foreground">{o.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.phone ? `Tel: ${o.phone} · ` : ""}
                  {o.open_orders} {o.open_orders === 1 ? "orden abierta" : "órdenes abiertas"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    o.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {o.active ? "Activo" : "Inactivo"}
                </span>
                <Button
                  variant={o.active ? "secondary" : "default"}
                  size="sm"
                  onClick={() => toggleMutation.mutate({ id: o.id, active: !o.active })}
                >
                  {o.active ? "Desactivar" : "Activar"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar a {o.full_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Sus órdenes asignadas quedarán sin operario.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(o.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CreateOperarioDialog({
  onCreate,
}: {
  onCreate: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onCreate({ email, password, fullName, ...(phone ? { phone } : {}) });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear el operario");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Nuevo operario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de alta operario</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="op-fullName">Nombre y apellidos</Label>
            <Input id="op-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-email">Email</Label>
            <Input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-password">Contraseña (mín. 8 caracteres)</Label>
            <Input
              id="op-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-phone">Teléfono</Label>
            <Input id="op-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear operario"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
