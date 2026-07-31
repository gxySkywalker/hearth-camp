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
  immersive = false,
  onAction,
  onCompanionInteract,
  companionMode,
  hearthLit = false,
  hearthAvailable = false,
}: {
  playerName: string
  playerAvatar?: string
  companion?: Companion | null
  immersive?: boolean
  onAction?: (action: CottageAction) => void
  onCompanionInteract?: () => void
  companionMode?: CottageCompanionMode
  hearthLit?: boolean
  hearthAvailable?: boolean
}) {
  return <PixiCottageScene
    playerName={playerName}
    playerAvatar={playerAvatar}
    companion={companion}
    immersive={immersive}
    onAction={onAction}
    onCompanionInteract={onCompanionInteract}
    companionMode={companionMode}
    hearthLit={hearthLit}
    hearthAvailable={hearthAvailable}
  />
}
