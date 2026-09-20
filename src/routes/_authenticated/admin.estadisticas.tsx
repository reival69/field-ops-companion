import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAveriasByUnit } from "@/lib/admin.functions";
import { formatCurrency } from "@/lib/workorder-ui";

export const Route = createFileRoute("/_authenticated/admin/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas — Panel de administración" },
      {
        name: "description",
        content: "Averías por piso o unidad: cuántas y cuánto han costado.",
      },
    ],
  }),
  component: EstadisticasPage,
});

function EstadisticasPage() {
  const fetchStats = useServerFn(getAveriasByUnit);
  const statsQuery = useQuery({ queryKey: ["averias-by-unit"], queryFn: () => fetchStats() });
  const rows = statsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">Averías por piso</h1>
      <p className="text-sm text-muted-foreground">
        Número de órdenes de trabajo y coste acumulado, agrupados por cliente y piso/unidad.
      </p>

      {statsQuery.isPending ? (
        <p className="mt-8 text-center text-muted-foreground">Cargando estadísticas…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">Todavía no hay órdenes registradas.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Piso / unidad</th>
                <th className="px-4 py-3 font-medium text-right">Averías</th>
                <th className="px-4 py-3 font-medium text-right">Coste total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.clientName}-${row.unit ?? ""}`} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-semibold">{row.clientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.unit ?? "Sin especificar"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(row.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
