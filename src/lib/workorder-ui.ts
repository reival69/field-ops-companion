import type { PhotoKind, WorkOrderStatus } from "./orders.functions";

export type Priority = "baja" | "media" | "alta";

export const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  pausada: "Pausada",
  finalizada: "Finalizada",
};

export const STATUS_CLASS: Record<WorkOrderStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_curso: "bg-primary/20 text-primary",
  pausada: "bg-warning/20 text-warning",
  finalizada: "bg-success/20 text-success",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  baja: "bg-secondary text-secondary-foreground",
  media: "bg-warning/20 text-warning",
  alta: "bg-destructive/25 text-destructive",
};

export const PHOTO_LABEL: Record<PhotoKind, string> = {
  antes: "Antes",
  despues: "Después",
};

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

export function monthKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function groupByMonth<T extends { scheduled_at: string }>(
  items: T[],
): { key: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = monthKey(item.scheduled_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: monthLabel(key),
    items: groupItems,
  }));
}
