import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkOrderStatus } from "./orders.functions";

type AuthedContext = { supabase: ReturnType<typeof unusedTypeHelper>; userId: string };
function unusedTypeHelper() {
  return null as never;
}

async function assertAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo los administradores pueden hacer esto");
}

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { exists: (count ?? 0) > 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; fullName: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Ya existe una cuenta de administrador");

    if (data.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear la cuenta");

    await supabaseAdmin.from("profiles").upsert({ id: created.user.id, full_name: data.fullName });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });

export const listOrdersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [ordersResult, profilesResult] = await Promise.all([
      context.supabase.from("work_orders").select("*").order("scheduled_at", { ascending: true }),
      context.supabase.from("profiles").select("id, full_name"),
    ]);
    if (ordersResult.error) throw new Error(ordersResult.error.message);

    const names = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name]));
    return (ordersResult.data ?? []).map((order) => ({
      ...order,
      assignee_name: order.assigned_to ? (names.get(order.assigned_to) ?? "Operario") : null,
    }));
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      clientName: string;
      address: string;
      contactPhone?: string;
      description: string;
      priority: "baja" | "media" | "alta";
      scheduledAt: string;
      assignedTo?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: created, error } = await context.supabase
      .from("work_orders")
      .insert({
        client_name: data.clientName,
        address: data.address,
        contact_phone: data.contactPhone ?? null,
        description: data.description,
        priority: data.priority,
        scheduled_at: data.scheduledAt,
        assigned_to: data.assignedTo ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const assignOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; assignedTo: string | null }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("work_orders")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("work_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOperarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const [rolesResult, profilesResult, ordersResult] = await Promise.all([
      context.supabase.from("user_roles").select("user_id, role").eq("role", "operario"),
      context.supabase.from("profiles").select("id, full_name, phone, active, created_at"),
      context.supabase.from("work_orders").select("assigned_to, status"),
    ]);
    if (rolesResult.error) throw new Error(rolesResult.error.message);

    const operarioIds = new Set((rolesResult.data ?? []).map((r) => r.user_id));
    const openByUser = new Map<string, number>();
    for (const order of ordersResult.data ?? []) {
      if (!order.assigned_to || order.status === "finalizada") continue;
      openByUser.set(order.assigned_to, (openByUser.get(order.assigned_to) ?? 0) + 1);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emails = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    return (profilesResult.data ?? [])
      .filter((profile) => operarioIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        active: profile.active,
        email: emails.get(profile.id) ?? "",
        open_orders: openByUser.get(profile.id) ?? 0,
      }));
  });

export const createOperario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; fullName: string; phone?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el operario");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.fullName, phone: data.phone ?? null });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "operario" });
    if (roleError) throw new Error(roleError.message);

    return { id: created.user.id };
  });

export const setOperarioActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: WorkOrderStatus }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("work_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: eventError } = await context.supabase.from("work_order_status_events").insert({
      work_order_id: data.id,
      status: data.status,
      changed_by: context.userId,
    });
    if (eventError) throw new Error(eventError.message);
    return { ok: true };
  });
