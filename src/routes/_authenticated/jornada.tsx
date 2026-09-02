import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, MapPin, Navigation } from "lucide-react";
import { getMySession, listMyOrders } from "@/lib/orders.functions";
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDay,
  formatTime,
  mapsUrl,
  type Priority,
} from "@/lib/workorder-ui";
import type { WorkOrderStatus } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({
    meta: [
      { title: "Mi jornada — Panel del Operario" },
      {
        name: "description",
        content: "Órdenes de trabajo asignadas, ordenadas por hora, con acceso directo a la ruta.",
      },
      { property: "og:title", content: "Mi jornada — Panel del Operario" },
      { property: "og:description", content: "Tus órdenes de trabajo del día en una pantalla." },
    ],
  }),
  component: JornadaPage,
});

function JornadaPage() {
  const fetchOrders = useServerFn(listMyOrders);
  const fetchSession = useServerFn(getMySession);

  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: () => fetchSession() });
  const ordersQuery = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders() });

  const orders = ordersQuery.data ?? [];
  const pendingCount = orders.filter((order) => order.status !== "finalizada").length;
  const firstName = (sessionQuery.data?.profile?.full_name ?? "").split(" ")[0];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <p className="label-caps text-primary">{formatDay(new Date().toISOString())}</p>
      <h1 className="mt-2 text-3xl font-extrabold">
        {firstName ? `Hola, ${firstName}` : "Mi jornada"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {ordersQuery.isPending
          ? "Cargando tus órdenes…"
          : pendingCount === 0
            ? "No tienes órdenes abiertas. Buen trabajo."
            : `${pendingCount} ${pendingCount === 1 ? "orden abierta" : "órdenes abiertas"}`}
      </p>

      {!ordersQuery.isPending && orders.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Todavía no tienes órdenes asignadas. Tu administrador te avisará cuando haya trabajo.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-border bg-card">
            <Link
              to="/orden/$id"
              params={{ id: order.id }}
              className="block px-4 pt-4 pb-3 active:bg-accent/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl font-bold tabular-nums">
                      {formatTime(order.scheduled_at)}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[order.status as WorkOrderStatus]}`}
                    >
                      {STATUS_LABEL[order.status as WorkOrderStatus]}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[order.priority as Priority]}`}
                    >
                      {PRIORITY_LABEL[order.priority as Priority]}
                    </span>
                  </div>
                  <p className="mt-2 text-lg leading-tight font-semibold">{order.client_name}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {order.address}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {order.description}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
            <a
              href={mapsUrl(order.address)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 border-t border-border py-3 text-sm font-semibold text-primary active:bg-accent/60"
            >
              <Navigation className="size-4" />
              Navegar
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
