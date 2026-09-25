import {
  FixtureBanner,
  Footer,
  Header,
  PageShell,
} from "@/components/AtlasChrome"
import { ExplorerPage } from "@/pages/ExplorerPage"
import { HomePage } from "@/pages/HomePage"
import { useAtlasNavigation } from "@/lib/atlasState"

export function App() {
  const {
    route,
    state,
    navigate,
    updateState,
    dataReady,
    dataPending,
    dataError,
  } = useAtlasNavigation()

  return (
    <div className="min-h-screen text-slate-950">
      <Header route={route} state={state} onNavigate={navigate} />
      <FixtureBanner level={state.level} />
      {dataPending && dataReady && (
        <div className="border-b border-sky-900/10 bg-sky-50/80 px-4 py-2 text-center text-xs font-medium text-sky-950">
          Cargando el período seleccionado…
        </div>
      )}
      {dataError && dataReady && (
        <div className="border-b border-rose-900/10 bg-rose-50/90 px-4 py-2 text-center text-xs font-medium text-rose-900">
          No se cambió la vista: {dataError}
        </div>
      )}
      <PageShell>
        {!dataReady ? (
          <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-950">
              Datos del Atlas
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold">
              {dataError ? "No se pudo cargar la publicación" : "Cargando publicación…"}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {dataError ?? "Leyendo hechos nacionales y el período territorial solicitado."}
            </p>
          </div>
        ) : route === "/explorar" ? (
          <ExplorerPage state={state} onChange={updateState} />
        ) : (
          <HomePage
            state={state}
            onChange={updateState}
            onExplore={() => navigate("/explorar", state)}
          />
        )}
      </PageShell>
      <Footer level={state.level} />
    </div>
  )
}
