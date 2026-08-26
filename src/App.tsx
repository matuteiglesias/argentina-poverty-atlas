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
  const { route, state, navigate, updateState } = useAtlasNavigation()

  return (
    <div className="min-h-screen text-slate-950">
      <Header route={route} state={state} onNavigate={navigate} />
      <FixtureBanner />
      <PageShell>
        {route === "/explorar" ? (
          <ExplorerPage state={state} onChange={updateState} />
        ) : (
          <HomePage
            state={state}
            onChange={updateState}
            onExplore={() => navigate("/explorar", state)}
          />
        )}
      </PageShell>
      <Footer />
    </div>
  )
}
