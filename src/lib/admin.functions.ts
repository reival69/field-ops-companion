import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkOrderStatus } from "./orders.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */


async function assertAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
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
      unit?: string;
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
        unit: data.unit ?? null,
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

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    const adminIds = (roles ?? []).map((r) => r.user_id);
    if (adminIds.length === 0) return [];

    const { data: profiles, error: profilesError } = await context.supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .in("id", adminIds);
    if (profilesError) throw new Error(profilesError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emails = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return adminIds
      .map((id) => ({
        id,
        full_name: profileMap.get(id)?.full_name ?? "",
        email: emails.get(id) ?? "",
        created_at: profileMap.get(id)?.created_at ?? null,
        is_self: id === context.userId,
      }))
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; fullName: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el administrador");

    await supabaseAdmin.from("profiles").upsert({ id: created.user.id, full_name: data.fullName });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);

    return { id: created.user.id };
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta de administrador");
    }

    const { count, error: countError } = await context.supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) <= 1) throw new Error("Debe quedar al menos un administrador");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOperario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
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

export const updateOperario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; fullName: string; phone?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName, phone: data.phone ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      clientName: string;
      address: string;
      unit?: string;
      contactPhone?: string;
      description: string;
      priority: "baja" | "media" | "alta";
      scheduledAt: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("work_orders")
      .update({
        client_name: data.clientName,
        address: data.address,
        unit: data.unit ?? null,
        contact_phone: data.contactPhone ?? null,
        description: data.description,
        priority: data.priority,
        scheduled_at: data.scheduledAt,
      })
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

export const getAveriasByUnit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("work_orders")
      .select("client_name, unit, cost");
    if (error) throw new Error(error.message);

    const groups = new Map<
      string,
      { clientName: string; unit: string | null; count: number; totalCost: number }
    >();
    for (const order of data ?? []) {
      const key = `${order.client_name} ${order.unit ?? ""}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalCost += order.cost ?? 0;
      } else {
        groups.set(key, {
          clientName: order.client_name,
          unit: order.unit,
          count: 1,
          totalCost: order.cost ?? 0,
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  });
