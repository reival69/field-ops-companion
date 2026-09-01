# Panel del Operario — MVP

App móvil (PWA) para operarios de mantenimiento + panel web de administración para la empresa de servicios.

## Diferenciación (UX radicalmente superior para el operario)

El coach señala que el riesgo es la adopción del operario. El MVP se diseña alrededor de eso:

- Pantalla única de "mi jornada": lista de órdenes del día, ordenadas por hora, con acción principal grande (Empezar / Finalizar).
- Cero formularios largos: estados con un toque, fotos con la cámara, navegación con un botón a Google Maps.
- Interfaz de una mano, botones grandes, alto contraste (uso a plena luz, con guantes).
- Feedback inmediato de cada acción y estado siempre visible.

## Roles y flujos

Operario (móvil)
- Login con email y contraseña (cuentas creadas por el admin).
- Lista de órdenes asignadas: cliente, dirección, hora, prioridad, estado.
- Detalle de orden: descripción de la avería, contacto, notas.
- Estados: pendiente → en curso → pausada → finalizada, con marca de tiempo de cada cambio.
- Fotos antes/después: cámara o galería, subida al almacenamiento de Lovable Cloud.
- Botón "Navegar" que abre Google Maps con la dirección del servicio.
- Nota de cierre al finalizar.

Admin (web)
- Panel con estado en vivo de las órdenes (pendientes, en curso, finalizadas hoy).
- Gestión de operarios: alta, activar/desactivar, ver carga de trabajo.
- Crear orden: cliente, dirección, descripción, prioridad, fecha/hora, operario asignado.
- Reasignar orden y ver la ficha completa con fotos y cronología de estados.

## Instalable en el móvil

Manifest e iconos para "Añadir a pantalla de inicio" (sin modo offline en esta fase).

## Detalles técnicos

- Lovable Cloud (base de datos, autenticación, almacenamiento).
- Tablas: `profiles` (nombre, teléfono, activo), `user_roles` (admin/operario, tabla aparte por seguridad con función `has_role`), `work_orders`, `work_order_status_events`, `work_order_photos`.
- RLS: el operario solo lee/actualiza sus órdenes y sus fotos; el admin accede a todo vía `has_role`.
- Almacenamiento: bucket privado para fotos, con URLs firmadas.
- Rutas protegidas bajo `_authenticated`; redirección según rol (operario → jornada, admin → panel).
- Google Maps por enlace universal de navegación (sin clave de API).
- Datos de ejemplo (un admin, dos operarios y varias órdenes) para que las pantallas se vean pobladas desde el primer momento.

## Fuera de alcance ahora

Stripe/suscripciones, modo offline, firma del cliente, partes de materiales, notificaciones push.
