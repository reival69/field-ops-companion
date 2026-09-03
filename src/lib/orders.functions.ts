import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PHOTO_BUCKET = "work-order-photos";

export type Role = "admin" | "operario";
export type WorkOrderStatus = "pendiente" | "en_curso" | "pausada" | "finalizada";
export type PhotoKind = "antes" | "despues";

export const getMySession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rolesResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("id, full_name, phone, active").eq("id", userId).maybeSingle(),
    ]);

    const roles = rolesResult.data ?? [];
    const role: Role = roles.some((r) => r.role === "admin") ? "admin" : "operario";
    const claims = context.claims as { email?: string } | null;

    return {
      userId,
      role,
      email: claims?.email ?? null,
      profile: profileResult.data ?? null,
    };
  });

export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName: string; phone?: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name: data.fullName,
      phone: data.phone ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_orders")
      .select("*")
      .eq("assigned_to", context.userId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Orden no encontrada");

    const [eventsResult, photosResult] = await Promise.all([
      supabase
        .from("work_order_status_events")
        .select("*")
        .eq("work_order_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("work_order_photos")
        .select("*")
        .eq("work_order_id", data.id)
        .order("created_at", { ascending: true }),
    ]);

    const photos = photosResult.data ?? [];
    let signed: Array<{
      id: string;
      kind: PhotoKind;
      url: string | null;
      storage_path: string;
      created_at: string;
    }> = [];

    if (photos.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      signed = await Promise.all(
        photos.map(async (photo) => {
          const { data: urlData } = await supabaseAdmin.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(photo.storage_path, 60 * 60);
          return {
            id: photo.id,
            kind: photo.kind as PhotoKind,
            url: urlData?.signedUrl ?? null,
            storage_path: photo.storage_path,
            created_at: photo.created_at,
          };
        }),
      );
    }

    let assignee: { id: string; full_name: string; phone: string | null } | null = null;
    if (order.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", order.assigned_to)
        .maybeSingle();
      assignee = profile ?? null;
    }

    return { order, events: eventsResult.data ?? [], photos: signed, assignee };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: WorkOrderStatus; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      status: WorkOrderStatus;
      started_at?: string;
      finished_at?: string;
      closing_note?: string;
    } = { status: data.status };
    if (data.status === "en_curso") patch.started_at = new Date().toISOString();
    if (data.status === "finalizada") {
      patch.finished_at = new Date().toISOString();
      if (data.note) patch.closing_note = data.note;
    }

    const { error } = await supabase.from("work_orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { error: eventError } = await supabase.from("work_order_status_events").insert({
      work_order_id: data.id,
      status: data.status,
      note: data.note ?? null,
      changed_by: userId,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true };
  });

export const requestPhotoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; kind: PhotoKind; extension: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("work_orders")
      .select("id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Orden no encontrada");

    const safeExtension = /^[a-z0-9]{1,5}$/i.test(data.extension) ? data.extension.toLowerCase() : "jpg";
    const path = `${data.orderId}/${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);
    if (signError || !signed) throw new Error(signError?.message ?? "No se pudo preparar la subida");

    return { path: signed.path, token: signed.token };
  });

export const savePhotoRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; kind: PhotoKind; path: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("work_order_photos").insert({
      work_order_id: data.orderId,
      kind: data.kind,
      storage_path: data.path,
      uploaded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: photo, error } = await context.supabase
      .from("work_order_photos")
      .select("id, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!photo) throw new Error("Foto no encontrada");

    const { error: deleteError } = await context.supabase
      .from("work_order_photos")
      .delete()
      .eq("id", data.id);
    if (deleteError) throw new Error(deleteError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

    return { ok: true };
  });
