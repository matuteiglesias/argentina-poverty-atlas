import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { fixtureRelease } from "@/data/fixture"
import type { AtlasRoute, AtlasState } from "@/lib/atlasState"

interface HeaderProps {
  route: AtlasRoute
  state: AtlasState
  onNavigate: (route: AtlasRoute, state?: AtlasState) => void
}

export function Header({ route, state, onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[#f7f3ea]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <button
          className="group text-left"
          onClick={() => onNavigate("/", state)}
          aria-label="Ir al inicio del Atlas de pobreza"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Argentina
          </span>
          <span className="font-serif text-lg font-semibold tracking-[-0.015em] text-slate-950 group-hover:text-sky-950">
            Atlas de pobreza
          </span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Navegación principal">
          <Button
            variant="ghost"
            className={route === "/" ? "bg-white/75" : undefined}
            onClick={() => onNavigate("/", state)}
          >
            Lectura
          </Button>
          <Button
            variant={route === "/explorar" ? "default" : "ghost"}
            onClick={() => onNavigate("/explorar", state)}
          >
            Explorar
          </Button>
        </nav>
      </div>
    </header>
  )
}

export function FixtureBanner() {
  const isFixture = fixtureRelease.metadata.scientific_status === "synthetic_fixture"

  return (
    <div
      className="border-b border-amber-900/15 bg-amber-50/80"
      role="note"
      aria-label="Estado científico de los datos"
    >
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-amber-950 sm:px-8">
        <strong className="uppercase tracking-[0.12em]">
          {isFixture ? "Demostración" : "Investigación"}
        </strong>
        <span aria-hidden="true">·</span>
        <span>
          {isFixture
            ? "Los valores son sintéticos: sirven para evaluar el producto y no deben interpretarse como estimaciones de pobreza."
            : "Las estimaciones son de investigación y no constituyen estadísticas oficiales de INDEC."}
        </span>
      </div>
    </div>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return <main>{children}</main>
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-900/10 bg-white/25">
      <div className="mx-auto grid max-w-[96rem] gap-5 px-4 py-10 text-sm text-slate-600 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-serif text-xl font-semibold text-slate-900">
            Atlas de pobreza en Argentina
          </p>
          <p className="mt-2 max-w-2xl leading-6">
            Superficie pública de investigación. La interfaz separa datos, geografía y presentación para preservar trazabilidad científica.
          </p>
        </div>
        <div className="text-xs md:text-right">
          <p>release: {fixtureRelease.metadata.release_id}</p>
          <p>estado: {fixtureRelease.metadata.scientific_status}</p>
        </div>
      </div>
    </footer>
  )
}
