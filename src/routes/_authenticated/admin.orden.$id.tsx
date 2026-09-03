import { createFileRoute, Link } from "@tanstack/react-router";
import { OrderDetail } from "@/components/OrderDetail";

export const Route = createFileRoute("/_authenticated/admin/orden/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Orden ${params.id.slice(0, 8)} — Admin` },
      { name: "description", content: "Ficha completa de la orden con fotos y cronología." },
    ],
  }),
  component: AdminOrdenPage,
});

function AdminOrdenPage() {
  const { id } = Route.useParams();
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Volver a órdenes
      </Link>
      <OrderDetail orderId={id} />
    </main>
  );
}
