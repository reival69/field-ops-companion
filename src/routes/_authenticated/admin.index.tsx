import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  assignOrder,
  createOrder,
  deleteOrder,
  listOperarios,
  listOrdersAdmin,
  updateOrder,
} from "@/lib/admin.functions";
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatCurrency,
  formatDateTime,
  groupByMonth,
  type Priority,
} from "@/lib/workorder-ui";
import type { WorkOrderStatus } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Panel de administración — Órdenes" },
      {
        name: "description",
        content: "Gestiona órdenes de trabajo, asigna operarios y consulta el estado de cada servicio.",
      },
      { property: "og:title", content: "Panel de administración — Órdenes" },
      { property: "og:description", content: "Gestión de órdenes de trabajo y operarios." },
    ],
  }),
  component: AdminOrdersPage,
});

const STATUS_ORDER: WorkOrderStatus[] = ["pendiente", "en_curso", "pausada", "finalizada"];

function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchOrders = useServerFn(listOrdersAdmin);
  const fetchOperarios = useServerFn(listOperarios);
  const assign = useServerFn(assignOrder);
  const remove = useServerFn(deleteOrder);
  const create = useServerFn(createOrder);
  const update = useServerFn(updateOrder);

  const ordersQuery = useQuery({ queryKey: ["admin-orders"], queryFn: () => fetchOrders() });
  const operariosQuery = useQuery({ queryKey: ["operarios"], queryFn: () => fetchOperarios() });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["operarios"] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) =>
      assign({ data: { id, assignedTo } }),
    onSuccess: () => {
      toast.success("Orden reasignada");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Orden eliminada");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const operarios = (operariosQuery.data ?? []).filter((o) => o.active);

  // Stats always cover every order, regardless of how the list below is grouped by month.
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: orders.filter((o) => (o.status as WorkOrderStatus) === status).length,
  }));

  const previousClients = useMemo<PreviousClient[]>(() => {
    const map = new Map<string, PreviousClient>();
    for (const order of orders) {
      const key = `${order.client_name.trim().toLowerCase()}|${order.address.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          clientName: order.client_name,
          address: order.address,
          contactPhone: order.contact_phone ?? "",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
  }, [orders]);

  const monthGroups = groupByMonth(orders);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} en total · {orders.filter((o) => o.status === "pendiente").length} pendientes ·{" "}
            {orders.filter((o) => o.status === "en_curso").length} en curso
          </p>
        </div>
        <CreateOrderDialog
          operarios={operarios}
          previousClients={previousClients}
          onCreate={async (payload) => {
            const { id } = await create({ data: payload });
            invalidate();
            toast.success("Orden creada");
            void navigate({ to: "/admin/orden/$id", params: { id } });
          }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map(({ status, count }) => (
          <div key={status} className="rounded-xl border border-border bg-card p-4">
            <p className="label-caps text-muted-foreground">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{count}</p>
          </div>
        ))}
      </div>

      {ordersQuery.isPending ? (
        <p className="mt-8 text-center text-muted-foreground">Cargando órdenes…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">No hay órdenes. Crea la primera.</p>
      ) : (
        <div className="mt-6 space-y-8">
          {monthGroups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
                {group.label} · {group.items.length}{" "}
                {group.items.length === 1 ? "orden" : "órdenes"}
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Prioridad</th>
                      <th className="px-4 py-3 font-medium">Operario</th>
                      <th className="px-4 py-3 font-medium">Coste</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.items.map((order) => (
                      <tr key={order.id} className="hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <Link
                            to="/admin/orden/$id"
                            params={{ id: order.id }}
                            className="font-semibold hover:underline"
                          >
                            {order.client_name}
                            {order.unit ? ` · ${order.unit}` : ""}
                          </Link>
                          <p className="text-xs text-muted-foreground">{order.address}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(order.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[order.status as WorkOrderStatus]}`}
                          >
                            {STATUS_LABEL[order.status as WorkOrderStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[order.priority as Priority]}`}
                          >
                            {PRIORITY_LABEL[order.priority as Priority]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={order.assigned_to ?? "__none__"}
                            onValueChange={(value) =>
                              assignMutation.mutate({
                                id: order.id,
                                assignedTo: value === "__none__" ? null : value,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin asignar</SelectItem>
                              {operarios.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.cost != null ? formatCurrency(order.cost) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <EditOrderDialog
                              order={order}
                              onSave={async (payload) => {
                                await update({ data: { id: order.id, ...payload } });
                                invalidate();
                                toast.success("Orden actualizada");
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Eliminar orden"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (confirm(`¿Eliminar la orden de ${order.client_name}?`))
                                  deleteMutation.mutate(order.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

type PreviousClient = { clientName: string; address: string; contactPhone: string };

type OperarioLite = { id: string; full_name: string };

function CreateOrderDialog({
  operarios,
  previousClients,
  onCreate,
}: {
  operarios: OperarioLite[];
  previousClients: PreviousClient[];
  onCreate: (payload: {
    clientName: string;
    address: string;
    unit?: string;
    contactPhone?: string;
    description: string;
    priority: "baja" | "media" | "alta";
    scheduledAt: string;
    assignedTo?: string | null;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("__new__");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"baja" | "media" | "alta">("media");
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("__none__");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setSelectedClient("__new__");
    setClientName("");
    setAddress("");
    setUnit("");
    setContactPhone("");
    setDescription("");
    setPriority("media");
    setScheduledAt("");
    setAssignedTo("__none__");
  };

  const applyClient = (value: string) => {
    setSelectedClient(value);
    if (value === "__new__") return;
    const client = previousClients[Number(value)];
    if (!client) return;
    setClientName(client.clientName);
    setAddress(client.address);
    setContactPhone(client.contactPhone);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onCreate({
        clientName,
        address,
        ...(unit.trim() ? { unit: unit.trim() } : {}),
        ...(contactPhone ? { contactPhone } : {}),
        description,
        priority,
        scheduledAt: new Date(scheduledAt).toISOString(),
        assignedTo: assignedTo === "__none__" ? null : assignedTo,
      });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear la orden");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Nueva orden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear orden de trabajo</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {previousClients.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="previousClient">Cliente ya registrado</Label>
              <Select value={selectedClient} onValueChange={applyClient}>
                <SelectTrigger id="previousClient">
                  <SelectValue placeholder="Nuevo cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">Nuevo cliente</SelectItem>
                  {previousClients.map((client, index) => (
                    <SelectItem key={`${client.clientName}-${client.address}`} value={String(index)}>
                      {client.clientName} — {client.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Elige uno para rellenar sus datos automáticamente, o sigue con "Nuevo cliente".
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="clientName">Cliente</Label>
            <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Piso / unidad (opcional)</Label>
            <Input
              id="unit"
              placeholder="3ºA"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Teléfono de contacto</Label>
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "baja" | "media" | "alta")}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Fecha y hora</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción de la avería</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Asignar a</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="assignedTo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {operarios.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear orden"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditableOrder = {
  client_name: string;
  address: string;
  unit: string | null;
  contact_phone: string | null;
  description: string;
  priority: string;
  scheduled_at: string;
};

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function EditOrderDialog({
  order,
  onSave,
}: {
  order: EditableOrder;
  onSave: (payload: {
    clientName: string;
    address: string;
    unit?: string;
    contactPhone?: string;
    description: string;
    priority: "baja" | "media" | "alta";
    scheduledAt: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState(order.client_name);
  const [address, setAddress] = useState(order.address);
  const [unit, setUnit] = useState(order.unit ?? "");
  const [contactPhone, setContactPhone] = useState(order.contact_phone ?? "");
  const [description, setDescription] = useState(order.description);
  const [priority, setPriority] = useState<"baja" | "media" | "alta">(
    order.priority as "baja" | "media" | "alta",
  );
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(order.scheduled_at));
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onSave({
        clientName,
        address,
        ...(unit.trim() ? { unit: unit.trim() } : {}),
        ...(contactPhone ? { contactPhone } : {}),
        description,
        priority,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar la orden");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setClientName(order.client_name);
          setAddress(order.address);
          setUnit(order.unit ?? "");
          setContactPhone(order.contact_phone ?? "");
          setDescription(order.description);
          setPriority(order.priority as "baja" | "media" | "alta");
          setScheduledAt(toLocalInputValue(order.scheduled_at));
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Editar orden"
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar orden de trabajo</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="edit-clientName">Cliente</Label>
            <Input
              id="edit-clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">Dirección</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-unit">Piso / unidad (opcional)</Label>
            <Input id="edit-unit" placeholder="3ºA" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-contactPhone">Teléfono de contacto</Label>
              <Input
                id="edit-contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "baja" | "media" | "alta")}>
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-scheduledAt">Fecha y hora</Label>
            <Input
              id="edit-scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción de la avería</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
