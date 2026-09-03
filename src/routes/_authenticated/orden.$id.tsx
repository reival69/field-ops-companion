import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OrderDetail } from "@/components/OrderDetail";

export const Route = createFileRoute("/_authenticated/orden/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Orden ${params.id.slice(0, 8)} — Panel del Operario` },
      { name: "description", content: "Detalle de la orden de trabajo: estado, fotos y cronología." },
    ],
  }),
  component: OrdenPage,
});

function OrdenPage() {
  const { id } = Route.useParams();
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/jornada"
        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Volver a mi jornada
      </Link>
      <OrderDetail orderId={id} />
    </main>
  );
}
