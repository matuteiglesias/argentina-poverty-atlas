import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import type { AtlasRoute, AtlasState } from "@/lib/atlasState"

interface HeaderProps {
  route: AtlasRoute
  state: AtlasState
  onNavigate: (route: AtlasRoute, state?: AtlasState) => void
}

export function Header({ route, state, onNavigate }: HeaderProps) {
  return (
    <header className="border-b border-slate-900/10 bg-[#f7f3ea]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <button
          className="text-left"
          onClick={() => onNavigate("/", state)}
          aria-label="Ir al inicio del Atlas de pobreza"
        >
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Argentina
          </span>
          <span className="font-serif text-lg font-semibold text-slate-950">
            Atlas de pobreza
          </span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Navegación principal">
          <Button
            variant="ghost"
            className={route === "/" ? "bg-white/70" : undefined}
            onClick={() => onNavigate("/", state)}
          >
            Inicio
          </Button>
          <Button
            variant="ghost"
            className={route === "/explorar" ? "bg-white/70" : undefined}
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
  return (
    <div
      className="border-b border-amber-900/15 bg-amber-50/80"
      role="note"
      aria-label="Aviso de datos sintéticos"
    >
      <div className="mx-auto max-w-7xl px-5 py-2.5 text-sm text-amber-950 sm:px-8">
        <strong>Datos de demostración.</strong>{" "}
        Valores sintéticos para desarrollar el atlas; no son estimaciones reales
        ni estadísticas oficiales.
      </div>
    </div>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
}

export function Footer() {
  return (
    <footer className="mt-14 border-t border-slate-900/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Atlas de pobreza en Argentina · superficie pública de investigación</span>
        <span>W1 · datos sintéticos · sin Mapbox</span>
      </div>
    </footer>
  )
}
