import { activeRelease } from "@/data/activeRelease"
import { descriptorFromEmbeddedRelease } from "@/data/releaseCatalog"

export const activeReleases = [descriptorFromEmbeddedRelease(activeRelease)] as const
