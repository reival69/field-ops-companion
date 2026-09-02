import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Camera, MapPin, PlayCircle, Smartphone, ShieldCheck } from "lucide-react";
import iconUrl from "../../public/icon-512.png?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel del Operario — el brazo técnico en el inmueble" },
      {
        name: "description",
        content:
          "App móvil para operarios de mantenimiento y panel web para la empresa: órdenes asignadas, estados en un toque, fotos antes/después y navegación GPS.",
      },
      { property: "og:title", content: "Panel del Operario — el brazo técnico en el inmueble" },
      {
        property: "og:description",
        content:
          "Órdenes de trabajo, estados en un toque, fotos antes/después y navegación GPS para tu red de profesionales.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ClipboardCheck,
    title: "Mi jornada, en una pantalla",
    text: "El operario abre la app y ve sus órdenes del día ordenadas por hora. Sin buscar, sin filtros.",
  },
  {
    icon: PlayCircle,
    title: "Estados en un toque",
    text: "Empezar, pausar y finalizar con botones grandes. Cada cambio queda registrado con su hora.",
  },
  {
    icon: Camera,
    title: "Fotos antes y después",
    text: "Documenta el trabajo desde la cámara del móvil. Sin formularios ni informes en papel.",
  },
  {
    icon: MapPin,
    title: "Navegación al cliente",
    text: "Un botón abre la ruta en Google Maps con la dirección del servicio.",
  },
  {
    icon: Smartphone,
    title: "Se instala como una app",
    text: "Añádela a la pantalla de inicio del móvil. Se abre a pantalla completa, sin navegador.",
  },
  {
    icon: ShieldCheck,
    title: "Panel para la empresa",
    text: "Crea órdenes, asigna operarios y sigue el estado de cada servicio en tiempo real.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          <img src={iconUrl} alt="" width={40} height={40} className="size-10 rounded-lg" />
          <span className="font-display text-lg font-bold tracking-tight">Panel del Operario</span>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-16 md:pt-20">
          <p className="label-caps text-primary">Mantenimiento · Servicios de campo</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-extrabold text-balance md:text-6xl">
            El brazo técnico en el inmueble, en el bolsillo de tu operario.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Nada de CMMS pesados. Una app pensada para usarse con una mano, con guantes y a plena
            luz: el operario ve su jornada, marca el estado, sube las fotos y navega al cliente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Acceder a mi cuenta
            </Link>
            <a
              href="#como-funciona"
              className="rounded-md border border-border px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Cómo funciona
            </a>
          </div>
        </section>

        <section id="como-funciona" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-bold md:text-3xl">Lo que hace el MVP</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-border bg-card p-6">
                  <feature.icon className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-8 md:p-12">
            <h2 className="text-2xl font-bold md:text-3xl">¿Primera vez aquí?</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Crea la cuenta de administrador de tu empresa, da de alta a tus operarios y asigna la
              primera orden en menos de cinco minutos.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Empezar
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">
          Panel del Operario · Nuestra red de profesionales
        </div>
      </footer>
    </div>
  );
}
