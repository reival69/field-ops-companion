# Field Ops Companion

Contexto cargado desde el Roadmap Scoper: "Panel del Operario

El brazo técnico en el inmueble. Nuestra red de profesionales".

Briefing del producto:

- Tipo de producto: App móvil (PWA)

- Sector: Mantenimiento

- Cliente ideal (ICP): Servicios

Veredicto del coach:

La idea aborda una necesidad real en el sector de mantenimiento, pero la diferenciación es clave para competir con soluciones existentes y la validación de la adopción por parte del operario será crítica.

Recomendación (pivot):

Aunque la necesidad es real y el producto es construible, la falta de una diferenciación contundente frente a soluciones existentes (CMMS/GMAO) y la resistencia a la adopción del usuario final (operario) podrían erosionar la viabilidad. Es fundamental refinar la propuesta de valor y el nicho antes de construir, quizás enfocándose en micro-nichos desatendidos o en una UX radicalmente superior para el operario.

Features imprescindibles del MVP:

- Registro y Login de Operario: Autenticación segura para que el operario acceda a sus tareas asignadas.

- Listado y Detalles de Órdenes de Trabajo: El operario visualiza las órdenes asignadas, fecha, ubicación, cliente y descripción de la avería.

- Actualización de Estados (Inicio/Fin): Funcionalidad para que el operario marque el estado de la orden de trabajo (en curso, finalizada, pausada, etc.).

- Subida de Fotos (Antes/Después): Permite al operario subir fotos desde la cámara del móvil o galería para documentar el trabajo.

- Navegación GPS al Cliente: Integración con Google Maps para guiar al operario a la ubicación del servicio.

- Módulo de Administración Web (Básico): Interfaz web para la empresa de servicios para gestionar operarios y visualizar el estado de las órdenes.

- Creación y Asignación de Órdenes (Admin): Desde el panel web, crear nuevas órdenes de trabajo y asignarlas a operarios.

Stack recomendado:

- Plantilla Lovable: dashboard

- Integraciones: Supabase, Stripe, Google Maps, Cloudinary

- Notas: Lovable ofrece una base robusta para la PWA del operario y el panel de administración. Supabase maneja la base de datos, autenticación y almacenamiento de imágenes. Stripe para futuras suscripciones, y Google Maps para la navegación. Cloudinary para optimizar el almacenamiento de imágenes.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/28262ee6-4911-493a-b574-ffa6891b4cba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
