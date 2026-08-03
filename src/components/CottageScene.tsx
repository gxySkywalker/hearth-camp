import type { Companion } from '../types'
import { PixiCottageScene } from './PixiCottageScene'
import type { CottageInteractionAction } from '../lib/cottage-scene'
import type { CottageCompanionMode } from '../lib/cottage-scene'

export type CottageAction = CottageInteractionAction

/**
 * The cottage is now a PixiJS-only world scene. Product pages, IPC and the
 * world database remain in React/Electron; only the playable map is rendered
 * by Pixi.
 */
export function CottageScene({
  playerName,
  playerAvatar = 'traveler_clothes',
  companion = null,
  companions = [],
  immersive = false,
  onAction,
  onCompanionInteract,
  companionMode,
  residentModes,
  pausedCompanionId,
  hearthLit = false,
  hearthAvailable = false,
}: {
  playerName: string
  playerAvatar?: string
  companion?: Companion | null
  companions?: Companion[]
  immersive?: boolean
  onAction?: (action: CottageAction) => void
  onCompanionInteract?: (companion: Companion) => void
  companionMode?: CottageCompanionMode
  residentModes?: Record<string, CottageCompanionMode>
  pausedCompanionId?: string | null
  hearthLit?: boolean
  hearthAvailable?: boolean
}) {
  return <PixiCottageScene
    playerName={playerName}
    playerAvatar={playerAvatar}
    companion={companion}
    companions={companions}
    immersive={immersive}
    onAction={onAction}
    onCompanionInteract={onCompanionInteract}
    companionMode={companionMode}
    residentModes={residentModes}
    pausedCompanionId={pausedCompanionId}
    hearthLit={hearthLit}
    hearthAvailable={hearthAvailable}
  />
}
