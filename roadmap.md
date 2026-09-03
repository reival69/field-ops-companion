# Roadmap — Panel del Operario MVP

## Done
- [x] Lovable Cloud habilitado, migración de schema + RLS aplicada
- [x] Bucket privado `work-order-photos` creado
- [x] Server functions: sesiones, órdenes, estados, fotos (`orders.functions.ts`)
- [x] Server functions admin: bootstrap, órdenes, operarios (`admin.functions.ts`)
- [x] Tema industrial oscuro, tipografías, iconos PWA, manifest
- [x] Landing pública (`/`)
- [x] Auth: login + bootstrap primer admin (`/auth`)
- [x] Layout protegido `_authenticated` con nav por rol
- [x] Jornada del operario (`/jornada`) — lista de órdenes por hora
- [x] Detalle de orden operario (`/orden/$id`) — estados, fotos, cronología
- [x] Panel admin de órdenes (`/admin`) — métricas, tabla, asignar, crear, borrar
- [x] Gestión de operarios (`/admin/operarios`) — alta, activar/desactivar
- [x] Detalle de orden admin (`/admin/orden/$id`)
- [x] Typecheck pasa, build OK, smoke test visual aprobado

## Open
- [ ] Advertencia de seguridad del linter sobre `has_role` ejecutable por authenticated (necesaria para RLS)
- [ ] Verificar flujo de subida de fotos end-to-end en runtime
