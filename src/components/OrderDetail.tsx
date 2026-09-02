import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Navigation, Phone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PHOTO_BUCKET,
  deletePhoto,
  getOrderDetail,
  requestPhotoUpload,
  savePhotoRecord,
  updateOrderStatus,
  type PhotoKind,
  type WorkOrderStatus,
} from "@/lib/orders.functions";
import {
  PHOTO_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDateTime,
  mapsUrl,
  type Priority,
} from "@/lib/workorder-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const NEXT_ACTIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pendiente: ["en_curso"],
  en_curso: ["pausada", "finalizada"],
  pausada: ["en_curso", "finalizada"],
  finalizada: [],
};

const ACTION_LABEL: Record<WorkOrderStatus, string> = {
  pendiente: "Marcar pendiente",
  en_curso: "Empezar trabajo",
  pausada: "Pausar",
  finalizada: "Finalizar",
};

export function OrderDetail({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getOrderDetail);
  const setStatus = useServerFn(updateOrderStatus);
  const prepareUpload = useServerFn(requestPhotoUpload);
  const saveRecord = useServerFn(savePhotoRecord);
  const removePhoto = useServerFn(deletePhoto);

  const [note, setNote] = useState("");
  const [uploadingKind, setUploadingKind] = useState<PhotoKind | null>(null);
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchDetail({ data: { id: orderId } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: WorkOrderStatus) =>
      setStatus({
        data: status === "finalizada" && note.trim() ? { id: orderId, status, note: note.trim() } : { id: orderId, status },
      }),
    onSuccess: (_result, status) => {
      toast.success(`Orden ${STATUS_LABEL[status].toLowerCase()}`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: PhotoKind }) => {
      const extension = file.name.split(".").pop() ?? "jpg";
      const signed = await prepareUpload({ data: { orderId, kind, extension } });
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (error) throw new Error(error.message);
      await saveRecord({ data: { orderId, kind, path: signed.path } });
    },
    onSuccess: () => {
      toast.success("Foto subida");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setUploadingKind(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePhoto({ data: { id } }),
    onSuccess: () => {
      toast.success("Foto eliminada");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (detailQuery.isPending) {
    return <p className="py-10 text-center text-muted-foreground">Cargando orden…</p>;
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <p className="py-10 text-center text-destructive">
        {detailQuery.error instanceof Error ? detailQuery.error.message : "No se pudo cargar"}
      </p>
    );
  }

  const { order, events, photos, assignee } = detailQuery.data;
  const status = order.status as WorkOrderStatus;
  const actions = NEXT_ACTIONS[status];

  const pickFile = (kind: PhotoKind) => {
    setUploadingKind(kind);
    (kind === "antes" ? beforeInput : afterInput).current?.click();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[order.priority as Priority]}`}
          >
            Prioridad {PRIORITY_LABEL[order.priority as Priority]}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold">{order.client_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{order.address}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Programada: {formatDateTime(order.scheduled_at)}
        </p>
        {assignee && (
          <p className="mt-1 text-sm text-muted-foreground">Asignada a: {assignee.full_name}</p>
        )}
        <p className="mt-4 whitespace-pre-line">{order.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={mapsUrl(order.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Navigation className="size-4" />
            Navegar
          </a>
          {order.contact_phone && (
            <a
              href={`tel:${order.contact_phone}`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold"
            >
              <Phone className="size-4" />
              Llamar
            </a>
          )}
        </div>
      </section>

      {actions.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="label-caps text-muted-foreground">Estado del trabajo</h2>
          {actions.includes("finalizada") && (
            <Textarea
              className="mt-3"
              placeholder="Nota de cierre (opcional): qué se ha hecho, materiales, incidencias…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {actions.map((action) => (
              <Button
                key={action}
                size="lg"
                variant={action === "finalizada" ? "default" : "secondary"}
                className="h-14 text-base font-semibold"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(action)}
              >
                {ACTION_LABEL[action]}
              </Button>
            ))}
          </div>
        </section>
      )}

      {order.closing_note && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="label-caps text-muted-foreground">Nota de cierre</h2>
          <p className="mt-2 whitespace-pre-line">{order.closing_note}</p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="label-caps text-muted-foreground">Fotos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["antes", "despues"] as PhotoKind[]).map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              size="lg"
              className="h-14 text-base font-semibold"
              disabled={uploadMutation.isPending}
              onClick={() => pickFile(kind)}
            >
              <Camera className="mr-2 size-5" />
              {uploadingKind === kind && uploadMutation.isPending
                ? "Subiendo…"
                : `Foto ${PHOTO_LABEL[kind].toLowerCase()}`}
            </Button>
          ))}
        </div>

        <input
          ref={beforeInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadMutation.mutate({ file, kind: "antes" });
          }}
        />
        <input
          ref={afterInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadMutation.mutate({ file, kind: "despues" });
          }}
        />

        {photos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Todavía no hay fotos de esta intervención.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-border">
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={`Foto ${PHOTO_LABEL[photo.kind].toLowerCase()} de la intervención`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full bg-muted" />
                )}
                <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="font-semibold">{PHOTO_LABEL[photo.kind]}</span>
                  <button
                    type="button"
                    aria-label="Eliminar foto"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(photo.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="label-caps text-muted-foreground">Cronología</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-semibold">{STATUS_LABEL[event.status as WorkOrderStatus]}</p>
                  <p className="text-muted-foreground">{formatDateTime(event.created_at)}</p>
                  {event.note && <p className="mt-1">{event.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
